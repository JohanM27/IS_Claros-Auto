import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { requireRoles } from '../auth/auth.middleware.js'
import type { EmployeeIdentity } from '../auth/auth.types.js'
import { HttpError } from '../../utils/httpError.js'
import {
  agregarTrabajo,
  consultarAuditoriaRegistros,
  consultarDiagnostico,
  editarTrabajo,
  guardarDiagnostico,
  hashWorkTaskRequest,
  listarTrabajos,
  retirarTrabajo,
} from './ordenTrabajo.registros.repository.js'

type RegistroDependencies = Partial<{
  getDiagnosis: typeof consultarDiagnostico
  saveDiagnosis: typeof guardarDiagnostico
  listTasks: typeof listarTrabajos
  getAudit: typeof consultarAuditoriaRegistros
  addTask: typeof agregarTrabajo
  editTask: typeof editarTrabajo
  removeTask: typeof retirarTrabajo
}>

const rolesAutorizados: EmployeeIdentity['role'][] = ['ADMINISTRADOR', 'RECEPCIONISTA']
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable().optional(),
  )
const diagnosisSchema = z
  .object({
    diagnostico: z.string().trim().min(1).max(4000),
    causaIdentificada: optionalText(2000),
    recomendaciones: optionalText(2000),
    observaciones: optionalText(2000),
  })
  .strict()
const decimalSchema = (integerDigits: number) =>
  z
    .string()
    .regex(
      new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,2})?$`),
      'Usa un importe decimal válido con hasta dos posiciones decimales.',
    )
const workTaskFields = {
  nombre: z.string().trim().min(1).max(150),
  descripcion: optionalText(2000),
  cantidad: decimalSchema(8).refine(
    (value) => Number(value) > 0,
    'La cantidad debe ser mayor que cero.',
  ),
  precioUnitario: decimalSchema(10),
  mecanicoResponsable: optionalText(150),
}
const createTaskSchema = z.object({ ...workTaskFields, idempotencyKey: z.uuid() }).strict()
const updateTaskSchema = z
  .object({
    ...workTaskFields,
    fechaActualizacionEsperada: z.iso.datetime({ offset: true }),
  })
  .strict()
const deleteTaskSchema = z
  .object({ fechaActualizacionEsperada: z.iso.datetime({ offset: true }) })
  .strict()

function parsedId(value: unknown) {
  const result = z.uuid().safeParse(value)
  if (!result.success)
    throw new HttpError(400, 'VALIDATION_ERROR', 'El identificador no es válido.')
  return result.data
}

export function crearRutasRegistrosOrdenTrabajo(
  authenticate: RequestHandler,
  dependencies: RegistroDependencies = {},
) {
  const router = Router()
  const authorize = [authenticate, requireRoles(...rolesAutorizados)]
  const getDiagnosis = dependencies.getDiagnosis ?? consultarDiagnostico
  const saveDiagnosis = dependencies.saveDiagnosis ?? guardarDiagnostico
  const listTasks = dependencies.listTasks ?? listarTrabajos
  const getAudit = dependencies.getAudit ?? consultarAuditoriaRegistros
  const addTask = dependencies.addTask ?? agregarTrabajo
  const editTask = dependencies.editTask ?? editarTrabajo
  const removeTask = dependencies.removeTask ?? retirarTrabajo

  router.get('/:id/diagnostico', ...authorize, async (request, response, next) => {
    try {
      response
        .set('Cache-Control', 'no-store')
        .json({ data: await getDiagnosis(parsedId(request.params.id)) })
    } catch (error) {
      next(error)
    }
  })

  router.put('/:id/diagnostico', ...authorize, async (request, response, next) => {
    try {
      const ordenTrabajoId = parsedId(request.params.id)
      const body = diagnosisSchema.safeParse(request.body)
      if (!body.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'Revisa los campos del diagnóstico.', {
          fieldErrors: body.error.flatten().fieldErrors,
        })
      const employee = request.employeeIdentity
      if (!employee)
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      const data = await saveDiagnosis({
        ordenTrabajoId,
        ...body.data,
        causaIdentificada: body.data.causaIdentificada ?? null,
        recomendaciones: body.data.recomendaciones ?? null,
        observaciones: body.data.observaciones ?? null,
        usuarioId: employee.userId,
      })
      response.set('Cache-Control', 'no-store').json({ data })
    } catch (error) {
      next(error)
    }
  })

  router.get('/:id/trabajos', ...authorize, async (request, response, next) => {
    try {
      response
        .set('Cache-Control', 'no-store')
        .json({ data: await listTasks(parsedId(request.params.id)) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/:id/auditoria', ...authorize, async (request, response, next) => {
    try {
      response
        .set('Cache-Control', 'no-store')
        .json({ data: await getAudit(parsedId(request.params.id)) })
    } catch (error) {
      next(error)
    }
  })

  router.post('/:id/trabajos', ...authorize, async (request, response, next) => {
    try {
      const ordenTrabajoId = parsedId(request.params.id)
      const body = createTaskSchema.safeParse(request.body)
      if (!body.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'Revisa los campos del trabajo realizado.', {
          fieldErrors: body.error.flatten().fieldErrors,
        })
      const employee = request.employeeIdentity
      if (!employee)
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      const values = {
        ...body.data,
        descripcion: body.data.descripcion ?? null,
        mecanicoResponsable: body.data.mecanicoResponsable ?? null,
      }
      const requestHash = hashWorkTaskRequest(values)
      const result = await addTask(ordenTrabajoId, employee.userId, {
        ...values,
        requestHash,
      })
      response
        .status(result.duplicate ? 200 : 201)
        .set('Cache-Control', 'no-store')
        .json({ data: result })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/:id/trabajos/:trabajoId', ...authorize, async (request, response, next) => {
    try {
      const ordenTrabajoId = parsedId(request.params.id)
      const trabajoId = parsedId(request.params.trabajoId)
      const body = updateTaskSchema.safeParse(request.body)
      if (!body.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'Revisa los campos del trabajo realizado.', {
          fieldErrors: body.error.flatten().fieldErrors,
        })
      const employee = request.employeeIdentity
      if (!employee)
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      const { fechaActualizacionEsperada, ...values } = body.data
      const data = await editTask(
        ordenTrabajoId,
        trabajoId,
        employee.userId,
        new Date(fechaActualizacionEsperada),
        {
          ...values,
          descripcion: values.descripcion ?? null,
          mecanicoResponsable: values.mecanicoResponsable ?? null,
        },
      )
      response.set('Cache-Control', 'no-store').json({ data })
    } catch (error) {
      next(error)
    }
  })

  router.delete('/:id/trabajos/:trabajoId', ...authorize, async (request, response, next) => {
    try {
      const ordenTrabajoId = parsedId(request.params.id)
      const trabajoId = parsedId(request.params.trabajoId)
      const body = deleteTaskSchema.safeParse(request.body)
      if (!body.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'Actualiza el trabajo antes de retirarlo.', {
          fieldErrors: body.error.flatten().fieldErrors,
        })
      const employee = request.employeeIdentity
      if (!employee)
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      const data = await removeTask(
        ordenTrabajoId,
        trabajoId,
        employee.userId,
        new Date(body.data.fechaActualizacionEsperada),
      )
      response.set('Cache-Control', 'no-store').json({ data })
    } catch (error) {
      next(error)
    }
  })

  return router
}
