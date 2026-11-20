import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'

const id = '5a0ac46b-a8ea-4f19-9cf3-1596c3a202de'

function appFor(role: 'ADMINISTRADOR' | 'RECEPCIONISTA' | 'MECANICO') {
  const list = vi.fn().mockResolvedValue([
    {
      id,
      numeroOrden: 'OT-0001',
      clienteId: id,
      vehiculoId: id,
      citaId: null,
      descripcionProblema: 'Ruido al frenar',
      observaciones: null,
      mecanicoResponsable: 'Carlos Pérez',
      estado: 'ABIERTA',
      fechaIngreso: new Date('2026-11-19T10:00:00.000Z'),
      fechaCreacion: new Date('2026-11-19T10:00:00.000Z'),
      fechaActualizacion: new Date('2026-11-19T10:00:00.000Z'),
      cliente: { name: 'Johan Moreno', phone: '97000000' },
      vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: null },
    },
  ])
  const app = createApp({
    authenticateEmployee: (_request, _response, next) => {
      _request.employeeIdentity = { userId: id, email: null, displayName: null, role }
      next()
    },
    ordenesTrabajo: { list },
  })
  return { app, list }
}

describe('API administrativa de órdenes de trabajo', () => {
  it('requiere una sesión autenticada', async () => {
    const response = await request(createApp()).get('/api/admin/ordenes')

    expect(response.status).toBe(401)
  })

  it.each(['ADMINISTRADOR', 'RECEPCIONISTA'] as const)('permite listar al rol %s', async (role) => {
    const { app, list } = appFor(role)
    const response = await request(app).get('/api/admin/ordenes')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.data[0].numeroOrden).toBe('OT-0001')
    expect(list).toHaveBeenCalledOnce()
  })

  it('devuelve una lista vacía cuando todavía no hay órdenes', async () => {
    const response = await request(
      createApp({
        authenticateEmployee: (_request, _response, next) => {
          _request.employeeIdentity = {
            userId: id,
            email: null,
            displayName: null,
            role: 'RECEPCIONISTA',
          }
          next()
        },
        ordenesTrabajo: { list: async () => [] },
      }),
    ).get('/api/admin/ordenes')

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
  })

  it('bloquea al rol MECANICO', async () => {
    const { app, list } = appFor('MECANICO')
    const response = await request(app).get('/api/admin/ordenes')

    expect(response.status).toBe(403)
    expect(list).not.toHaveBeenCalled()
  })
})
