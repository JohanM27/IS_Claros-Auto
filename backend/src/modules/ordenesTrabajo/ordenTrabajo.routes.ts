import { createHash } from 'node:crypto'
import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { requireRoles } from '../auth/auth.middleware.js'
import type { EmployeeIdentity } from '../auth/auth.types.js'
import { HttpError } from '../../utils/httpError.js'
import {
  buscarCitas,
  buscarClientes,
  consultarOrdenTrabajo,
  listarOrdenesTrabajo,
  registrarOrdenTrabajo,
  type FiltrosOrdenesTrabajo,
  type NuevaOrdenInput,
} from './ordenTrabajo.repository.js'

const rolesAutorizados: EmployeeIdentity['role'][] = ['ADMINISTRADOR', 'RECEPCIONISTA']
type ListWorkOrders = (filters: FiltrosOrdenesTrabajo) => ReturnType<typeof listarOrdenesTrabajo>
type GetWorkOrder = (id: string) => Promise<Awaited<ReturnType<typeof consultarOrdenTrabajo>>>
const listQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    estado: z
      .enum(['ABIERTA', 'EN_DIAGNOSTICO', 'EN_PROCESO', 'FINALIZADA', 'CANCELADA'])
      .optional(),
    fechaDesde: z.iso.date().optional(),
    fechaHasta: z.iso.date().optional(),
    mecanico: z.string().trim().min(1).max(150).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict()
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable().optional(),
  )
const createSchema = z
  .object({
    clienteId: z.uuid(),
    vehiculoId: z.uuid(),
    citaId: z.union([z.uuid(), z.null()]).optional(),
    descripcionProblema: z.string().trim().min(1).max(2000),
    observaciones: optionalText(2000),
    mecanicoResponsable: optionalText(150),
    kilometraje: z.union([z.number().int().min(0).max(2_000_000), z.null()]).optional(),
    fechaIngreso: z.iso.datetime({ offset: true }),
    idempotencyKey: z.uuid(),
  })
  .strict()

export function crearRutasOrdenesTrabajo(
  authenticate: RequestHandler,
  dependencies: {
    list?: ListWorkOrders
    get?: GetWorkOrder
    customers?: typeof buscarClientes
    appointments?: typeof buscarCitas
    create?: typeof registrarOrdenTrabajo
  } = {},
) {
  const router = Router()
  const list = dependencies.list ?? listarOrdenesTrabajo
  const get = dependencies.get ?? consultarOrdenTrabajo
  const customers = dependencies.customers ?? buscarClientes
  const appointments = dependencies.appointments ?? buscarCitas
  const create = dependencies.create ?? registrarOrdenTrabajo
  const authorize = [authenticate, requireRoles(...rolesAutorizados)]

  router.get('/clientes', ...authorize, async (request, response, next) => {
    try {
      const query = z.string().trim().min(2).max(100).safeParse(request.query.q)
      if (!query.success)
        throw new HttpError(
          400,
          'VALIDATION_ERROR',
          'Escribe al menos dos caracteres para buscar un cliente.',
        )
      response.set('Cache-Control', 'no-store').json({ data: await customers(query.data) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/citas', ...authorize, async (request, response, next) => {
    try {
      const query = z.object({ clienteId: z.uuid(), vehiculoId: z.uuid() }).safeParse(request.query)
      if (!query.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'Selecciona un cliente y vehículo válidos.')
      response
        .set('Cache-Control', 'no-store')
        .json({ data: await appointments(query.data.clienteId, query.data.vehiculoId) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/:id', ...authorize, async (request, response, next) => {
    try {
      const parsedId = z.uuid().safeParse(request.params.id)
      if (!parsedId.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'El identificador no es válido.')
      const workOrder = await get(parsedId.data)
      if (!workOrder)
        throw new HttpError(404, 'WORK_ORDER_NOT_FOUND', 'No se encontró la orden de trabajo.')
      response.set('Cache-Control', 'no-store').json({ data: workOrder })
    } catch (error) {
      next(error)
    }
  })

  router.get('/', ...authorize, async (request, response, next) => {
    try {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        throw new HttpError(
          400,
          'VALIDATION_ERROR',
          'Los filtros o la paginación no son válidos.',
          {
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        )
      }
      if (
        parsed.data.fechaDesde &&
        parsed.data.fechaHasta &&
        parsed.data.fechaDesde > parsed.data.fechaHasta
      ) {
        throw new HttpError(
          400,
          'VALIDATION_ERROR',
          'La fecha inicial debe ser anterior a la final.',
        )
      }
      const result = await list(parsed.data)
      response
        .set('Cache-Control', 'no-store')
        .json({ data: result.data, pagination: result.pagination })
    } catch (error) {
      next(error)
    }
  })

  router.post('/', ...authorize, async (request, response, next) => {
    try {
      const parsed = createSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Revisa los datos de la orden.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const values = parsed.data
      const payload = {
        clienteId: values.clienteId,
        vehiculoId: values.vehiculoId,
        citaId: values.citaId ?? null,
        descripcionProblema: values.descripcionProblema,
        observaciones: values.observaciones ?? null,
        mecanicoResponsable: values.mecanicoResponsable ?? null,
        kilometraje: values.kilometraje ?? null,
        fechaIngreso: new Date(values.fechaIngreso),
      }
      const input: NuevaOrdenInput = {
        ...payload,
        idempotencyKey: values.idempotencyKey,
        requestHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      }
      const result = await create(input)
      response
        .status(result.duplicate ? 200 : 201)
        .set('Cache-Control', 'no-store')
        .json({ data: result.order })
    } catch (error) {
      next(error)
    }
  })

  return router
}
