import { Router, type RequestHandler } from 'express'
import { authenticateEmployee } from './auth.middleware.js'

export function createAuthRouter(authenticate: RequestHandler = authenticateEmployee) {
  const router = Router()

  router.get('/me', authenticate, (request, response) => {
    const employee = request.employeeIdentity
    if (!employee) {
      response.status(401).json({
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Inicia sesión para continuar.' },
      })
      return
    }

    response
      .status(200)
      .set('Cache-Control', 'no-store')
      .json({
        data: {
          id: employee.userId,
          email: employee.email,
          role: employee.role,
          displayName: employee.displayName,
        },
      })
  })

  return router
}
