import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { requireRoles } from '../auth/auth.middleware.js'
import type { EmployeeIdentity } from '../auth/auth.types.js'
import { HttpError } from '../../utils/httpError.js'
import { canReadInventoryCosts } from './inventario.permissions.js'
import {
  actualizarCategoria,
  cambiarEstadoCategoria,
  consultarCategoria,
  crearCategoria,
  listarCategorias,
  type CategoriaPatchInput,
  type FiltrosCategorias,
} from './categorias.repository.js'
import { consultarResumenInventario, type ResumenInventario } from './inventario.repository.js'
import {
  actualizarRepuesto,
  cambiarEstadoRepuesto,
  consultarRepuesto,
  crearRepuesto,
  listarRepuestos,
  type FiltrosRepuestos,
  type NuevoRepuestoInput,
  type RepuestoPatchInput,
} from './repuestos.repository.js'
import {
  actualizarRepuestoSchema,
  actualizarCategoriaSchema,
  estadoCategoriaSchema,
  estadoRepuestoSchema,
  filtrosCategoriasSchema,
  filtrosRepuestosSchema,
  nuevaCategoriaSchema,
  nuevoRepuestoSchema,
} from './inventario.validation.js'

type ConsultarResumen = (incluirCostos: boolean) => Promise<ResumenInventario>
type ListarCategorias = (
  filters: FiltrosCategorias,
  soloActivas?: boolean,
) => ReturnType<typeof listarCategorias>
type ConsultarCategoria = typeof consultarCategoria
type CrearCategoria = typeof crearCategoria
type ActualizarCategoria = (
  id: string,
  input: CategoriaPatchInput,
) => ReturnType<typeof actualizarCategoria>
type CambiarEstadoCategoria = typeof cambiarEstadoCategoria
type ListarRepuestos = (
  filters: FiltrosRepuestos,
  incluirCostos: boolean,
  soloActivos?: boolean,
) => Promise<{
  data: unknown[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}>
type ConsultarRepuesto = (
  id: string,
  incluirCostos: boolean,
  soloActivos?: boolean,
) => Promise<unknown | null>
type CrearRepuesto = (input: NuevoRepuestoInput) => Promise<unknown>
type ActualizarRepuesto = (
  id: string,
  input: RepuestoPatchInput,
  incluirCostos: boolean,
) => Promise<unknown>
type CambiarEstadoRepuesto = (id: string, activo: boolean) => Promise<unknown>

export function crearRutasInventario(
  authenticate: RequestHandler,
  dependencies: {
    getSummary?: ConsultarResumen
    listCategories?: ListarCategorias
    getCategory?: ConsultarCategoria
    createCategory?: CrearCategoria
    updateCategory?: ActualizarCategoria
    setCategoryActive?: CambiarEstadoCategoria
    listParts?: ListarRepuestos
    getPart?: ConsultarRepuesto
    createPart?: CrearRepuesto
    updatePart?: ActualizarRepuesto
    setPartActive?: CambiarEstadoRepuesto
  } = {},
) {
  const router = Router()
  const getSummary = dependencies.getSummary ?? consultarResumenInventario
  const listCategories = dependencies.listCategories ?? listarCategorias
  const getCategory = dependencies.getCategory ?? consultarCategoria
  const createCategory = dependencies.createCategory ?? crearCategoria
  const updateCategory = dependencies.updateCategory ?? actualizarCategoria
  const setCategoryActive = dependencies.setCategoryActive ?? cambiarEstadoCategoria
  const listParts = dependencies.listParts ?? listarRepuestos
  const getPart = dependencies.getPart ?? consultarRepuesto
  const createPart = dependencies.createPart ?? crearRepuesto
  const updatePart = dependencies.updatePart ?? actualizarRepuesto
  const setPartActive = dependencies.setPartActive ?? cambiarEstadoRepuesto
  const readRoles: EmployeeIdentity['role'][] = ['ADMINISTRADOR', 'RECEPCIONISTA']
  const readAccess = [authenticate, requireRoles(...readRoles)]
  const adminAccess = [authenticate, requireRoles('ADMINISTRADOR')]

  router.get('/repuestos', ...readAccess, async (request, response, next) => {
    try {
      const parsed = filtrosRepuestosSchema.safeParse(request.query)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Los filtros de repuestos no son válidos.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const employee = request.employeeIdentity
      if (!employee)
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      const result = await listParts(
        parsed.data,
        canReadInventoryCosts(employee.role),
        employee.role === 'RECEPCIONISTA',
      )
      response
        .set('Cache-Control', 'no-store')
        .json({ data: result.data, pagination: result.pagination })
    } catch (error) {
      next(error)
    }
  })

  router.get('/repuestos/:id', ...readAccess, async (request, response, next) => {
    try {
      const id = z.uuid().safeParse(request.params.id)
      if (!id.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'El identificador de repuesto no es válido.')
      const employee = request.employeeIdentity
      if (!employee)
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      const item = await getPart(
        id.data,
        canReadInventoryCosts(employee.role),
        employee.role === 'RECEPCIONISTA',
      )
      if (!item) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'No se encontró el repuesto.')
      response.set('Cache-Control', 'no-store').json({ data: item })
    } catch (error) {
      next(error)
    }
  })

  router.post('/repuestos', ...adminAccess, async (request, response, next) => {
    try {
      const parsed = nuevoRepuestoSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Revisa los datos del repuesto.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const item = await createPart(parsed.data)
      response.status(201).set('Cache-Control', 'no-store').json({ data: item })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/repuestos/:id', ...adminAccess, async (request, response, next) => {
    try {
      const id = z.uuid().safeParse(request.params.id)
      if (!id.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'El identificador de repuesto no es válido.')
      const parsed = actualizarRepuestoSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Revisa los datos del repuesto.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const item = await updatePart(id.data, parsed.data, true)
      response.set('Cache-Control', 'no-store').json({ data: item })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/repuestos/:id/estado', ...adminAccess, async (request, response, next) => {
    try {
      const id = z.uuid().safeParse(request.params.id)
      if (!id.success)
        throw new HttpError(400, 'VALIDATION_ERROR', 'El identificador de repuesto no es válido.')
      const parsed = estadoRepuestoSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Indica el estado que tendrá el repuesto.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const item = await setPartActive(id.data, parsed.data.activo)
      response.set('Cache-Control', 'no-store').json({ data: item })
    } catch (error) {
      next(error)
    }
  })

  router.get('/resumen', ...readAccess, async (request, response, next) => {
    try {
      const employee = request.employeeIdentity
      if (!employee) {
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      }

      const summary = await getSummary(canReadInventoryCosts(employee.role))
      response.set('Cache-Control', 'no-store').json({ data: summary })
    } catch (error) {
      next(error)
    }
  })

  router.get('/categorias', ...readAccess, async (request, response, next) => {
    try {
      const parsed = filtrosCategoriasSchema.safeParse(request.query)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Los filtros de categorías no son válidos.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const employee = request.employeeIdentity
      if (!employee) {
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      }
      const result = await listCategories(parsed.data, employee.role === 'RECEPCIONISTA')
      response
        .set('Cache-Control', 'no-store')
        .json({ data: result.data, pagination: result.pagination })
    } catch (error) {
      next(error)
    }
  })

  router.get('/categorias/:id', ...readAccess, async (request, response, next) => {
    try {
      const parsedId = z.uuid().safeParse(request.params.id)
      if (!parsedId.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'El identificador de categoría no es válido.')
      }
      const employee = request.employeeIdentity
      if (!employee) {
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
      }
      const category = await getCategory(parsedId.data)
      if (!category || (employee.role === 'RECEPCIONISTA' && !category.activo)) {
        throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'No se encontró la categoría.')
      }
      response.set('Cache-Control', 'no-store').json({ data: category })
    } catch (error) {
      next(error)
    }
  })

  router.post('/categorias', ...adminAccess, async (request, response, next) => {
    try {
      const parsed = nuevaCategoriaSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Revisa los datos de la categoría.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const category = await createCategory(parsed.data)
      response.status(201).set('Cache-Control', 'no-store').json({ data: category })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/categorias/:id', ...adminAccess, async (request, response, next) => {
    try {
      const parsedId = z.uuid().safeParse(request.params.id)
      if (!parsedId.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'El identificador de categoría no es válido.')
      }
      const parsed = actualizarCategoriaSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Revisa los datos de la categoría.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const category = await updateCategory(parsedId.data, parsed.data)
      response.set('Cache-Control', 'no-store').json({ data: category })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/categorias/:id/estado', ...adminAccess, async (request, response, next) => {
    try {
      const parsedId = z.uuid().safeParse(request.params.id)
      if (!parsedId.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'El identificador de categoría no es válido.')
      }
      const parsed = estadoCategoriaSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Indica el estado que tendrá la categoría.', {
          fieldErrors: parsed.error.flatten().fieldErrors,
        })
      }
      const category = await setCategoryActive(parsedId.data, parsed.data.activo)
      response.set('Cache-Control', 'no-store').json({ data: category })
    } catch (error) {
      next(error)
    }
  })

  return router
}
