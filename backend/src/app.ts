import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { errorHandler } from './middleware/errorHandler.js'
import { crearRutasCitas } from './modules/citas/cita.routes.js'
import { crearRutasServicios } from './modules/servicios/servicio.routes.js'
import { healthRouter } from './routes/health.js'
import { apiConfig } from './config/api.js'
import { HttpError } from './utils/httpError.js'
import { createAuthRouter } from './modules/auth/auth.routes.js'
import { authenticateEmployee } from './modules/auth/auth.middleware.js'
import type { RequestHandler } from 'express'
import { createAdminRouter } from './modules/admin/admin.routes.js'

export type ApiDependencies = {
  listarServicios?: Parameters<typeof crearRutasServicios>[0]
  registrarCita?: Parameters<typeof crearRutasCitas>[0]
  consultarCita?: Parameters<typeof crearRutasCitas>[1]
  authenticateEmployee?: RequestHandler
  admin?: Parameters<typeof createAdminRouter>[1]
}

export function createApp(dependencies: ApiDependencies = {}) {
  const app = express()

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || apiConfig.allowedOrigins.has(origin)) {
          callback(null, true)
          return
        }
        callback(
          new HttpError(
            403,
            'ORIGIN_NOT_ALLOWED',
            'El origen de esta solicitud no está permitido.',
          ),
        )
      },
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', healthRouter)
  app.use('/api/auth', createAuthRouter(dependencies.authenticateEmployee))
  app.use(
    '/api/admin',
    createAdminRouter(
      dependencies.authenticateEmployee ?? authenticateEmployee,
      dependencies.admin,
    ),
  )
  app.use('/api/servicios', crearRutasServicios(dependencies.listarServicios))
  app.use(
    '/api/citas',
    crearRutasCitas(
      dependencies.registrarCita,
      dependencies.consultarCita,
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Se alcanzó el límite de solicitudes. Intenta más tarde.',
          },
        },
      }),
    ),
  )
  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.' },
    })
  })
  app.use(errorHandler)

  return app
}

export const app = createApp()
