import { createHash } from 'node:crypto'
import { prisma } from '../../config/database.js'
import { Prisma, type WorkOrderStatus } from '../../generated/prisma/client.js'
import { HttpError } from '../../utils/httpError.js'

const estadosCerrados: WorkOrderStatus[] = ['FINALIZADA', 'CANCELADA']
type Runner = <T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) => Promise<T>
const transaccion: Runner = async (operation) => {
  try {
    return await prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'P2034' || error.code === 'P2028')
    ) {
      throw new HttpError(
        409,
        'WORK_ORDER_CHANGED_CONCURRENTLY',
        'La orden cambió durante la operación. Actualiza la información e inténtalo de nuevo.',
      )
    }
    throw error
  }
}

type DiagnosticoInput = {
  ordenTrabajoId: string
  diagnostico: string
  causaIdentificada: string | null
  recomendaciones: string | null
  observaciones: string | null
  usuarioId: string
}

type TrabajoInput = {
  nombre: string
  descripcion: string | null
  cantidad: string
  precioUnitario: string
  mecanicoResponsable: string | null
  idempotencyKey: string
  requestHash: string
}

function ensureOpen(state: WorkOrderStatus) {
  if (estadosCerrados.includes(state)) {
    throw new HttpError(
      409,
      'WORK_ORDER_CLOSED',
      'La orden finalizada o cancelada es de solo lectura.',
    )
  }
}

async function lockAndReadOrder(transaction: Prisma.TransactionClient, id: string) {
  await transaction.$queryRaw`SELECT "id" FROM "WorkOrder" WHERE "id" = ${id}::uuid FOR UPDATE`
  const order = await transaction.workOrder.findUnique({
    where: { id },
    select: { id: true, estado: true, mecanicoResponsable: true },
  })
  if (!order)
    throw new HttpError(404, 'WORK_ORDER_NOT_FOUND', 'No se encontró la orden de trabajo.')
  ensureOpen(order.estado)
  return order
}

function snapshot(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject
}

export function consultarDiagnostico(ordenTrabajoId: string) {
  return prisma.workOrder
    .findUnique({ where: { id: ordenTrabajoId }, select: { id: true } })
    .then(async (order) => {
      if (!order)
        throw new HttpError(404, 'WORK_ORDER_NOT_FOUND', 'No se encontró la orden de trabajo.')
      return prisma.diagnosticoOrden.findUnique({
        where: { ordenTrabajoId },
        include: {
          usuarioRegistro: { select: { userId: true, displayName: true } },
          usuarioActualizacion: { select: { userId: true, displayName: true } },
        },
      })
    })
}

export async function guardarDiagnostico(input: DiagnosticoInput, runner: Runner = transaccion) {
  return runner(async (transaction) => {
    const order = await lockAndReadOrder(transaction, input.ordenTrabajoId)
    const previous = await transaction.diagnosticoOrden.findUnique({
      where: { ordenTrabajoId: order.id },
    })
    const data = {
      diagnostico: input.diagnostico,
      causaIdentificada: input.causaIdentificada,
      recomendaciones: input.recomendaciones,
      observaciones: input.observaciones,
      usuarioActualizacionId: input.usuarioId,
    }
    const record = previous
      ? await transaction.diagnosticoOrden.update({ where: { id: previous.id }, data })
      : await transaction.diagnosticoOrden.create({
          data: { ...data, ordenTrabajoId: order.id, usuarioRegistroId: input.usuarioId },
        })
    const accion = previous ? 'ACTUALIZADO' : 'CREADO'
    if (previous) {
      await transaction.diagnosticoOrdenHistory.create({
        data: {
          diagnosticoOrdenId: previous.id,
          diagnostico: previous.diagnostico,
          causaIdentificada: previous.causaIdentificada,
          recomendaciones: previous.recomendaciones,
          observaciones: previous.observaciones,
          usuarioId: input.usuarioId,
        },
      })
    }
    await transaction.workOrderRecordHistory.create({
      data: {
        ordenTrabajoId: order.id,
        tipo: 'DIAGNOSTICO',
        accion,
        registroId: record.id,
        usuarioId: input.usuarioId,
        snapshot: snapshot({ ...record, mecanicoResponsable: order.mecanicoResponsable }),
      },
    })
    return transaction.diagnosticoOrden.findUniqueOrThrow({
      where: { id: record.id },
      include: {
        usuarioRegistro: { select: { userId: true, displayName: true } },
        usuarioActualizacion: { select: { userId: true, displayName: true } },
      },
    })
  })
}

export async function listarTrabajos(ordenTrabajoId: string) {
  const order = await prisma.workOrder.findUnique({
    where: { id: ordenTrabajoId },
    select: { id: true },
  })
  if (!order)
    throw new HttpError(404, 'WORK_ORDER_NOT_FOUND', 'No se encontró la orden de trabajo.')
  const trabajos = await prisma.trabajoRealizado.findMany({
    where: { ordenTrabajoId, activo: true },
    orderBy: [{ fechaCreacion: 'asc' }, { id: 'asc' }],
    include: {
      usuarioRegistro: { select: { userId: true, displayName: true } },
      usuarioActualizacion: { select: { userId: true, displayName: true } },
    },
  })
  const withSubtotal = trabajos.map((item) => ({
    ...item,
    subtotal: calcularSubtotal(item.cantidad, item.precioUnitario),
  }))
  const total = trabajos.reduce(
    (sum, item) => sum.plus(calcularSubtotal(item.cantidad, item.precioUnitario)),
    new Prisma.Decimal(0),
  )
  return {
    trabajos: withSubtotal,
    totalManoObra: total.toDecimalPlaces(2).toFixed(2),
    moneda: 'HNL' as const,
  }
}

export function calcularSubtotal(cantidad: Prisma.Decimal, precioUnitario: Prisma.Decimal) {
  return cantidad.mul(precioUnitario).toDecimalPlaces(2).toFixed(2)
}

export async function consultarAuditoriaRegistros(ordenTrabajoId: string) {
  const order = await prisma.workOrder.findUnique({
    where: { id: ordenTrabajoId },
    select: { id: true },
  })
  if (!order)
    throw new HttpError(404, 'WORK_ORDER_NOT_FOUND', 'No se encontró la orden de trabajo.')
  return prisma.workOrderRecordHistory.findMany({
    where: { ordenTrabajoId },
    orderBy: [{ fechaCambio: 'desc' }, { id: 'desc' }],
    include: { usuario: { select: { userId: true, displayName: true } } },
  })
}

export async function agregarTrabajo(
  ordenTrabajoId: string,
  usuarioId: string,
  input: TrabajoInput,
  runner: Runner = transaccion,
) {
  const existing = await prisma.trabajoRealizado.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (existing) {
    if (existing.ordenTrabajoId !== ordenTrabajoId || existing.requestHash !== input.requestHash) {
      throw new HttpError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'La clave de solicitud ya fue utilizada con otros datos.',
      )
    }
    return { trabajo: existing, duplicate: true }
  }
  try {
    const trabajo = await runner(async (transaction) => {
      const order = await lockAndReadOrder(transaction, ordenTrabajoId)
      const created = await transaction.trabajoRealizado.create({
        data: {
          ordenTrabajoId: order.id,
          nombre: input.nombre,
          descripcion: input.descripcion,
          cantidad: new Prisma.Decimal(input.cantidad),
          precioUnitario: new Prisma.Decimal(input.precioUnitario),
          mecanicoResponsable: input.mecanicoResponsable,
          usuarioRegistroId: usuarioId,
          usuarioActualizacionId: usuarioId,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
        },
      })
      await transaction.workOrderRecordHistory.create({
        data: {
          ordenTrabajoId: order.id,
          tipo: 'TRABAJO',
          accion: 'CREADO',
          registroId: created.id,
          usuarioId,
          snapshot: snapshot(created),
        },
      })
      return {
        ...created,
        subtotal: calcularSubtotal(created.cantidad, created.precioUnitario),
      }
    })
    return { trabajo, duplicate: false }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const retry = await prisma.trabajoRealizado.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      })
      if (
        retry &&
        retry.ordenTrabajoId === ordenTrabajoId &&
        retry.requestHash === input.requestHash
      ) {
        return { trabajo: retry, duplicate: true }
      }
    }
    throw error
  }
}

export async function editarTrabajo(
  ordenTrabajoId: string,
  trabajoId: string,
  usuarioId: string,
  expectedUpdatedAt: Date,
  input: Omit<TrabajoInput, 'idempotencyKey' | 'requestHash'>,
  runner: Runner = transaccion,
) {
  return runner(async (transaction) => {
    await lockAndReadOrder(transaction, ordenTrabajoId)
    const previous = await transaction.trabajoRealizado.findFirst({
      where: { id: trabajoId, ordenTrabajoId, activo: true },
    })
    if (!previous)
      throw new HttpError(
        404,
        'WORK_TASK_NOT_FOUND',
        'No se encontró el trabajo activo en esta orden.',
      )
    if (previous.fechaActualizacion.getTime() !== expectedUpdatedAt.getTime()) {
      throw new HttpError(
        409,
        'WORK_TASK_CHANGED_CONCURRENTLY',
        'El trabajo cambió. Actualiza la orden e inténtalo de nuevo.',
      )
    }
    const result = await transaction.trabajoRealizado.updateMany({
      where: { id: trabajoId, ordenTrabajoId, activo: true, fechaActualizacion: expectedUpdatedAt },
      data: {
        nombre: input.nombre,
        descripcion: input.descripcion,
        cantidad: new Prisma.Decimal(input.cantidad),
        precioUnitario: new Prisma.Decimal(input.precioUnitario),
        mecanicoResponsable: input.mecanicoResponsable,
        usuarioActualizacionId: usuarioId,
      },
    })
    if (result.count !== 1)
      throw new HttpError(
        409,
        'WORK_TASK_CHANGED_CONCURRENTLY',
        'El trabajo cambió. Actualiza la orden e inténtalo de nuevo.',
      )
    const updated = await transaction.trabajoRealizado.findUniqueOrThrow({
      where: { id: trabajoId },
    })
    await transaction.workOrderRecordHistory.create({
      data: {
        ordenTrabajoId,
        tipo: 'TRABAJO',
        accion: 'ACTUALIZADO',
        registroId: trabajoId,
        usuarioId,
        snapshot: snapshot({ anterior: previous, nuevo: updated }),
      },
    })
    return {
      ...updated,
      subtotal: calcularSubtotal(updated.cantidad, updated.precioUnitario),
    }
  })
}

export async function retirarTrabajo(
  ordenTrabajoId: string,
  trabajoId: string,
  usuarioId: string,
  expectedUpdatedAt: Date,
  runner: Runner = transaccion,
) {
  return runner(async (transaction) => {
    await lockAndReadOrder(transaction, ordenTrabajoId)
    const previous = await transaction.trabajoRealizado.findFirst({
      where: { id: trabajoId, ordenTrabajoId, activo: true },
    })
    if (!previous)
      throw new HttpError(
        404,
        'WORK_TASK_NOT_FOUND',
        'No se encontró el trabajo activo en esta orden.',
      )
    if (previous.fechaActualizacion.getTime() !== expectedUpdatedAt.getTime()) {
      throw new HttpError(
        409,
        'WORK_TASK_CHANGED_CONCURRENTLY',
        'El trabajo cambió. Actualiza la orden e inténtalo de nuevo.',
      )
    }
    const now = new Date()
    const result = await transaction.trabajoRealizado.updateMany({
      where: { id: trabajoId, ordenTrabajoId, activo: true, fechaActualizacion: expectedUpdatedAt },
      data: { activo: false, fechaRetiro: now, usuarioActualizacionId: usuarioId },
    })
    if (result.count !== 1)
      throw new HttpError(
        409,
        'WORK_TASK_CHANGED_CONCURRENTLY',
        'El trabajo cambió. Actualiza la orden e inténtalo de nuevo.',
      )
    const removed = await transaction.trabajoRealizado.findUniqueOrThrow({
      where: { id: trabajoId },
    })
    await transaction.workOrderRecordHistory.create({
      data: {
        ordenTrabajoId,
        tipo: 'TRABAJO',
        accion: 'RETIRADO',
        registroId: trabajoId,
        usuarioId,
        snapshot: snapshot({ anterior: previous, retirado: removed }),
      },
    })
    return {
      ...removed,
      subtotal: calcularSubtotal(removed.cantidad, removed.precioUnitario),
    }
  })
}

export function hashWorkTaskRequest(input: Omit<TrabajoInput, 'requestHash'>) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}
