import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'

const id = '5a0ac46b-a8ea-4f19-9cf3-1596c3a202de'

function appFor(role: 'ADMINISTRADOR' | 'RECEPCIONISTA' | 'MECANICO') {
  let requestedStatus = ''
  const app = createApp({
    authenticateEmployee: (_request, _response, next) => {
      _request.employeeIdentity = { userId: id, email: null, displayName: null, role }
      next()
    },
    admin: {
      list: async () => [{
        id, status: 'PENDIENTE' as const, requestedAt: new Date(), createdAt: new Date(), notes: null,
        customer: { name: 'Johan', phone: '97000000', email: null },
        vehicle: { make: 'Ford', model: 'Escape', year: 2017 }, service: { name: 'Diagnóstico' },
      }],
      update: async (_id, status) => {
        requestedStatus = status
        return { id, status, requestedAt: new Date(), createdAt: new Date() }
      },
    },
  })
  return { app, status: () => requestedStatus }
}

describe('API administrativa de citas', () => {
  it('lista citas a recepción y administración', async () => {
    const { app } = appFor('RECEPCIONISTA')
    const response = await request(app).get('/api/admin/citas')
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.data[0].status).toBe('PENDIENTE')
  })

  it('deniega el listado al rol mecánico', async () => {
    const { app } = appFor('MECANICO')
    const response = await request(app).get('/api/admin/citas')
    expect(response.status).toBe(403)
  })

  it('permite confirmar o cancelar solo una cita pendiente', async () => {
    const { app, status } = appFor('ADMINISTRADOR')
    const response = await request(app).patch(`/api/admin/citas/${id}/estado`).send({ status: 'CONFIRMADA' })
    expect(response.status).toBe(200)
    expect(status()).toBe('CONFIRMADA')
  })

  it('valida identificador y estado de la cita', async () => {
    const { app } = appFor('RECEPCIONISTA')
    const response = await request(app).patch('/api/admin/citas/no-valido/estado').send({ status: 'COMPLETADA' })
    expect(response.status).toBe(400)
  })
})
