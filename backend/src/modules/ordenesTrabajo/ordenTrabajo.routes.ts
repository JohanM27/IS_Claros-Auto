import { Router, type RequestHandler } from 'express'
import { requireRoles } from '../auth/auth.middleware.js'
import type { EmployeeIdentity } from '../auth/auth.types.js'
import { listarOrdenesTrabajo } from './ordenTrabajo.repository.js'

const rolesAutorizados: EmployeeIdentity['role'][] = ['ADMINISTRADOR', 'RECEPCIONISTA']
type WorkOrderSummary = Awaited<ReturnType<typeof listarOrdenesTrabajo>>
type ListWorkOrders = () => Promise<WorkOrderSummary>

export function crearRutasOrdenesTrabajo(
  authenticate: RequestHandler,
  dependencies: { list?: ListWorkOrders } = {},
) {
  const router = Router()
  const list = dependencies.list ?? listarOrdenesTrabajo

  router.get(
    '/',
    authenticate,
    requireRoles(...rolesAutorizados),
    async (_request, response, next) => {
      try {
        response.set('Cache-Control', 'no-store').json({ data: await list() })
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
