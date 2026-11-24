import { prisma } from '../../config/database.js'
import { Prisma } from '../../generated/prisma/client.js'
import type { WorkOrderStatus } from '../../generated/prisma/client.js'
import { HttpError } from '../../utils/httpError.js'
import { validarTransicionEstadoOrden } from './ordenTrabajo.estado.js'
import { validarCitaDisponible, validarVehiculoDelCliente } from './ordenTrabajo.validation.js'
import { formatearNumeroOrden } from './ordenTrabajo.number.js'

export type FiltrosOrdenesTrabajo = {
  q?: string
  estado?: 'ABIERTA' | 'EN_DIAGNOSTICO' | 'EN_PROCESO' | 'FINALIZADA' | 'CANCELADA'
  fechaDesde?: string
  fechaHasta?: string
  mecanico?: string
  page: number
  pageSize: number
}

export function crearWhereOrdenesTrabajo(filters: FiltrosOrdenesTrabajo) {
  const where: Prisma.WorkOrderWhereInput = {}
  const AND: Prisma.WorkOrderWhereInput[] = []

  if (filters.q) {
    AND.push({
      OR: [
        { numeroOrden: { contains: filters.q, mode: 'insensitive' } },
        { cliente: { name: { contains: filters.q, mode: 'insensitive' } } },
        { vehiculo: { plate: { contains: filters.q, mode: 'insensitive' } } },
      ],
    })
  }
  if (filters.estado) AND.push({ estado: filters.estado })
  if (filters.mecanico) {
    AND.push({ mecanicoResponsable: { contains: filters.mecanico, mode: 'insensitive' } })
  }
  if (filters.fechaDesde || filters.fechaHasta) {
    const fechaIngreso: Prisma.DateTimeFilter = {}
    if (filters.fechaDesde) fechaIngreso.gte = new Date(`${filters.fechaDesde}T00:00:00.000Z`)
    if (filters.fechaHasta) {
      const exclusiveEnd = new Date(`${filters.fechaHasta}T00:00:00.000Z`)
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
      fechaIngreso.lt = exclusiveEnd
    }
    AND.push({ fechaIngreso })
  }
  if (AND.length > 0) where.AND = AND
  return where
}

export async function listarOrdenesTrabajo(filters: FiltrosOrdenesTrabajo) {
  const where = crearWhereOrdenesTrabajo(filters)
  const [total, data] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: [{ fechaIngreso: 'desc' }, { fechaCreacion: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        numeroOrden: true,
        descripcionProblema: true,
        mecanicoResponsable: true,
        estado: true,
        fechaIngreso: true,
        cliente: { select: { name: true } },
        vehiculo: { select: { make: true, model: true, year: true, plate: true } },
      },
    }),
  ])
  return {
    data,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  }
}

export function consultarOrdenTrabajo(id: string) {
  return prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true,
      numeroOrden: true,
      clienteId: true,
      vehiculoId: true,
      citaId: true,
      descripcionProblema: true,
      observaciones: true,
      mecanicoResponsable: true,
      kilometraje: true,
      estado: true,
      fechaIngreso: true,
      fechaCreacion: true,
      fechaActualizacion: true,
      cliente: { select: { name: true, phone: true, email: true } },
      vehiculo: { select: { make: true, model: true, year: true, plate: true } },
      cita: {
        select: {
          id: true,
          requestedAt: true,
          status: true,
          service: { select: { name: true } },
        },
      },
    },
  })
}

export async function consultarHistorialOrdenTrabajo(ordenTrabajoId: string) {
  const order = await prisma.workOrder.findUnique({
    where: { id: ordenTrabajoId },
    select: { id: true },
  })
  if (!order) return null

  return prisma.workOrderStatusHistory.findMany({
    where: { ordenTrabajoId },
    orderBy: [{ fechaCambio: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      estadoAnterior: true,
      estadoNuevo: true,
      observaciones: true,
      fechaCambio: true,
      usuario: { select: { userId: true, displayName: true } },
    },
  })
}

export type CambioEstadoOrdenInput = {
  ordenTrabajoId: string
  estadoActualEsperado: WorkOrderStatus
  estadoNuevo: WorkOrderStatus
  observaciones: string | null
  usuarioId: string
}

type WorkOrderTransactionRunner = <T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>

export async function cambiarEstadoOrdenTrabajo(
  input: CambioEstadoOrdenInput,
  transactionRunner: WorkOrderTransactionRunner = (operation) => prisma.$transaction(operation),
) {
  return transactionRunner(async (transaction) => {
    const order = await transaction.workOrder.findUnique({
      where: { id: input.ordenTrabajoId },
      select: { estado: true },
    })
    if (!order) {
      throw new HttpError(404, 'WORK_ORDER_NOT_FOUND', 'No se encontró la orden de trabajo.')
    }
    if (order.estado !== input.estadoActualEsperado) {
      throw new HttpError(
        409,
        'WORK_ORDER_CHANGED_CONCURRENTLY',
        'La orden cambió desde que la consultaste. Actualiza la página e inténtalo de nuevo.',
      )
    }

    validarTransicionEstadoOrden(order.estado, input.estadoNuevo, input.observaciones)

    const update = await transaction.workOrder.updateMany({
      where: { id: input.ordenTrabajoId, estado: input.estadoActualEsperado },
      data: { estado: input.estadoNuevo },
    })
    if (update.count !== 1) {
      throw new HttpError(
        409,
        'WORK_ORDER_CHANGED_CONCURRENTLY',
        'La orden cambió desde que la consultaste. Actualiza la página e inténtalo de nuevo.',
      )
    }

    await transaction.workOrderStatusHistory.create({
      data: {
        ordenTrabajoId: input.ordenTrabajoId,
        estadoAnterior: order.estado,
        estadoNuevo: input.estadoNuevo,
        observaciones: input.observaciones,
        usuarioId: input.usuarioId,
      },
    })

    return transaction.workOrder.findUniqueOrThrow({
      where: { id: input.ordenTrabajoId },
      select: {
        id: true,
        numeroOrden: true,
        clienteId: true,
        vehiculoId: true,
        citaId: true,
        descripcionProblema: true,
        observaciones: true,
        mecanicoResponsable: true,
        kilometraje: true,
        estado: true,
        fechaIngreso: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        cliente: { select: { name: true, phone: true, email: true } },
        vehiculo: { select: { make: true, model: true, year: true, plate: true } },
        cita: {
          select: {
            id: true,
            requestedAt: true,
            status: true,
            service: { select: { name: true } },
          },
        },
      },
    })
  })
}

export async function buscarClientes(query: string) {
  return prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
    take: 20,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      vehicles: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, make: true, model: true, year: true, plate: true },
      },
    },
  })
}

export async function buscarCitas(clienteId: string, vehiculoId: string) {
  return prisma.appointment.findMany({
    where: {
      customerId: clienteId,
      vehicleId: vehiculoId,
      status: { in: ['PENDIENTE', 'CONFIRMADA'] },
      workOrder: null,
    },
    orderBy: { requestedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      requestedAt: true,
      status: true,
      service: { select: { name: true } },
    },
  })
}

export type NuevaOrdenInput = {
  clienteId: string
  vehiculoId: string
  citaId: string | null
  descripcionProblema: string
  observaciones: string | null
  mecanicoResponsable: string | null
  kilometraje: number | null
  fechaIngreso: Date
  idempotencyKey: string
  requestHash: string
}

export async function registrarOrdenTrabajo(input: NuevaOrdenInput) {
  const existing = await prisma.workOrder.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (existing) {
    if (existing.requestHash !== input.requestHash) {
      throw new HttpError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Esta solicitud ya se procesó con otros datos.',
      )
    }
    return { order: existing, duplicate: true }
  }

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.findFirst({
        where: { id: input.vehiculoId, customerId: input.clienteId },
        select: { id: true },
      })
      validarVehiculoDelCliente(Boolean(vehicle))

      if (input.citaId) {
        const appointment = await transaction.appointment.findFirst({
          where: {
            id: input.citaId,
            customerId: input.clienteId,
            vehicleId: input.vehiculoId,
            status: { in: ['PENDIENTE', 'CONFIRMADA'] },
            workOrder: null,
          },
          select: { id: true },
        })
        validarCitaDisponible(Boolean(appointment))
      }

      const sequence = await transaction.$queryRaw<
        Array<{ value: bigint }>
      >`SELECT nextval('"work_order_number_seq"') AS value`
      const numeroOrden = formatearNumeroOrden(sequence[0].value)
      return transaction.workOrder.create({
        data: {
          numeroOrden,
          clienteId: input.clienteId,
          vehiculoId: input.vehiculoId,
          citaId: input.citaId,
          descripcionProblema: input.descripcionProblema,
          observaciones: input.observaciones,
          mecanicoResponsable: input.mecanicoResponsable,
          kilometraje: input.kilometraje,
          fechaIngreso: input.fechaIngreso,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          estado: 'ABIERTA',
        },
        select: {
          id: true,
          numeroOrden: true,
          clienteId: true,
          vehiculoId: true,
          citaId: true,
          descripcionProblema: true,
          observaciones: true,
          mecanicoResponsable: true,
          kilometraje: true,
          estado: true,
          fechaIngreso: true,
          fechaCreacion: true,
          fechaActualizacion: true,
          cliente: { select: { name: true, phone: true } },
          vehiculo: { select: { make: true, model: true, year: true, plate: true } },
        },
      })
    })
    return { order, duplicate: false }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const retry = await prisma.workOrder.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      })
      if (retry) {
        if (retry.requestHash !== input.requestHash) {
          throw new HttpError(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'Esta solicitud ya se procesó con otros datos.',
          )
        }
        return { order: retry, duplicate: true }
      }
      throw new HttpError(
        409,
        'APPOINTMENT_ALREADY_REGISTERED',
        'La cita ya está asociada a una orden de trabajo.',
      )
    }
    throw error
  }
}
