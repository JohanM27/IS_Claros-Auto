import { Router, type RequestHandler } from 'express'
import { requireRoles } from '../auth/auth.middleware.js'
import type { EmployeeIdentity } from '../auth/auth.types.js'
import { HttpError } from '../../utils/httpError.js'
import { canReadInventoryCosts } from './inventario.permissions.js'
import { consultarResumenInventario, type ResumenInventario } from './inventario.repository.js'

type ConsultarResumen = (incluirCostos: boolean) => Promise<ResumenInventario>

export function crearRutasInventario(
  authenticate: RequestHandler,
  dependencies: { getSummary?: ConsultarResumen } = {},
) {
  const router = Router()
  const getSummary = dependencies.getSummary ?? consultarResumenInventario
  const roles: EmployeeIdentity['role'][] = ['ADMINISTRADOR', 'RECEPCIONISTA']

  router.get('/resumen', authenticate, requireRoles(...roles), async (request, response, next) => {
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

  return router
}
