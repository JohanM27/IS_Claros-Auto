import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database.js'
import { requireRoles } from '../auth/auth.middleware.js'
import type { EmployeeIdentity } from '../auth/auth.types.js'
import { HttpError } from '../../utils/httpError.js'

const roles: EmployeeIdentity['role'][] = ['ADMINISTRADOR', 'RECEPCIONISTA']
const statusSchema = z.object({ status: z.enum(['CONFIRMADA', 'CANCELADA']) }).strict()

async function listAppointments() {
  return prisma.appointment.findMany({
    orderBy: [{ requestedAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true, status: true, requestedAt: true, createdAt: true, notes: true,
      customer: { select: { name: true, phone: true, email: true } },
      vehicle: { select: { make: true, model: true, year: true } },
      service: { select: { name: true } },
    },
  })
}

async function updateAppointmentStatus(id: string, status: 'CONFIRMADA' | 'CANCELADA') {
  const result = await prisma.appointment.updateMany({
    where: { id, status: 'PENDIENTE' },
    data: { status },
  })
  if (result.count === 0) {
    const exists = await prisma.appointment.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new HttpError(404, 'APPOINTMENT_NOT_FOUND', 'No se encontró la cita.')
    throw new HttpError(409, 'APPOINTMENT_STATUS_CONFLICT', 'Solo se pueden actualizar citas pendientes.')
  }
  return prisma.appointment.findUniqueOrThrow({
    where: { id }, select: { id: true, status: true, requestedAt: true, createdAt: true },
  })
}

export function createAdminRouter(
  authenticate: RequestHandler,
  dependencies: {
    list?: typeof listAppointments
    update?: typeof updateAppointmentStatus
  } = {},
) {
  const router = Router()
  const list = dependencies.list ?? listAppointments
  const update = dependencies.update ?? updateAppointmentStatus
  router.get('/citas', authenticate, requireRoles(...roles), async (_request, response, next) => {
    try {
      response.set('Cache-Control', 'no-store').json({ data: await list() })
    } catch (error) { next(error) }
  })
  router.patch('/citas/:id/estado', authenticate, requireRoles(...roles), async (request, response, next) => {
    try {
      const parsedId = z.uuid().safeParse(request.params.id)
      const parsedBody = statusSchema.safeParse(request.body)
      if (!parsedId.success || !parsedBody.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'La cita o el estado no son válidos.')
      }
      const appointment = await update(parsedId.data, parsedBody.data.status)
      response.set('Cache-Control', 'no-store').json({ data: appointment })
    } catch (error) { next(error) }
  })
  return router
}
