import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'
import { errorHandler } from '../../middleware/errorHandler.js'
import { createAuthenticateEmployee, requireRoles } from './auth.middleware.js'
import type { EmployeeIdentity } from './auth.types.js'

const employeeId = '80c1c18c-7200-4ce3-8c6e-a06bcb7f72b3'

describe('autenticación de empleados', () => {
  it('responde 401 cuando falta el token Bearer', async () => {
    const verifyAccessToken = vi.fn()
    const app = createApp({
      authenticateEmployee: createAuthenticateEmployee({ verifyAccessToken }),
    })

    const response = await request(app).get('/api/auth/me')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED')
    expect(verifyAccessToken).not.toHaveBeenCalled()
  })

  it('responde 401 si Supabase rechaza el token', async () => {
    const app = createApp({
      authenticateEmployee: createAuthenticateEmployee({
        verifyAccessToken: vi.fn().mockResolvedValue(null),
        findProfile: vi.fn(),
      }),
    })

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('INVALID_SESSION')
  })

  it('responde 403 cuando la identidad válida no tiene perfil de empleado', async () => {
    const app = createApp({
      authenticateEmployee: createAuthenticateEmployee({
        verifyAccessToken: vi
          .fn()
          .mockResolvedValue({ id: employeeId, email: 'empleado@example.com' }),
        findProfile: vi.fn().mockResolvedValue(null),
      }),
    })

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('EMPLOYEE_ROLE_NOT_ASSIGNED')
  })

  it('lee el rol de una fuente de datos confiable y no del cuerpo enviado', async () => {
    const app = createApp({
      authenticateEmployee: createAuthenticateEmployee({
        verifyAccessToken: vi
          .fn()
          .mockResolvedValue({ id: employeeId, email: 'recepcion@example.com' }),
        findProfile: vi.fn().mockResolvedValue({ role: 'RECEPCIONISTA', displayName: 'Recepción' }),
      }),
    })

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ role: 'ADMINISTRADOR' })

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.data.role).toBe('RECEPCIONISTA')
    expect(response.body.data.email).toBe('recepcion@example.com')
  })
})

describe('autorización por rol', () => {
  function appForRole(role: EmployeeIdentity['role']) {
    const app = express()
    app.get(
      '/admin',
      (request, _response, next) => {
        request.employeeIdentity = {
          userId: employeeId,
          email: 'empleado@example.com',
          role,
          displayName: null,
        }
        next()
      },
      requireRoles('ADMINISTRADOR'),
      (_request, response) => response.sendStatus(204),
    )
    app.use(errorHandler)
    return app
  }

  it('responde 403 cuando el rol no está autorizado', async () => {
    const response = await request(appForRole('MECANICO')).get('/admin')

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
  })

  it('permite el rol requerido', async () => {
    const response = await request(appForRole('ADMINISTRADOR')).get('/admin')

    expect(response.status).toBe(204)
  })
})
