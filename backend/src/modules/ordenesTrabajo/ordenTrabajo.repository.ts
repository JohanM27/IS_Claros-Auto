import { prisma } from '../../config/database.js'
import { HttpError } from '../../utils/httpError.js'
import { validarCitaDisponible, validarVehiculoDelCliente } from './ordenTrabajo.validation.js'
import { formatearNumeroOrden } from './ordenTrabajo.number.js'

export function listarOrdenesTrabajo() {
  return prisma.workOrder.findMany({
    orderBy: [{ fechaIngreso: 'desc' }, { fechaCreacion: 'desc' }],
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
