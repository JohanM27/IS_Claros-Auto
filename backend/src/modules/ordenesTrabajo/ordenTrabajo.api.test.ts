import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'

const id = '5a0ac46b-a8ea-4f19-9cf3-1596c3a202de'
const secondId = '6b1bd57c-b9fb-4b2a-8df4-2607d4b313ef'

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
      kilometraje: 85000,
      estado: 'ABIERTA',
      fechaIngreso: new Date('2026-11-19T10:00:00.000Z'),
      fechaCreacion: new Date('2026-11-19T10:00:00.000Z'),
      fechaActualizacion: new Date('2026-11-19T10:00:00.000Z'),
      cliente: { name: 'Johan Moreno', phone: '97000000' },
      vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: null },
    },
  ])
  const create = vi.fn().mockImplementation(async (input) => ({
    order: {
      id,
      numeroOrden: 'OT-000001',
      clienteId: input.clienteId,
      vehiculoId: input.vehiculoId,
      citaId: input.citaId,
      descripcionProblema: input.descripcionProblema,
      observaciones: input.observaciones,
      mecanicoResponsable: input.mecanicoResponsable,
      kilometraje: input.kilometraje,
      estado: 'ABIERTA',
      fechaIngreso: input.fechaIngreso,
      fechaCreacion: input.fechaIngreso,
      fechaActualizacion: input.fechaIngreso,
      cliente: { name: 'Johan Moreno', phone: '97000000' },
      vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: null },
    },
    duplicate: false,
  }))
  const customers = vi.fn().mockResolvedValue([])
  const appointments = vi.fn().mockResolvedValue([])
  const app = createApp({
    authenticateEmployee: (_request, _response, next) => {
      _request.employeeIdentity = { userId: id, email: null, displayName: null, role }
      next()
    },
    ordenesTrabajo: { list, create, customers, appointments },
  })
  return { app, list, create, customers, appointments }
}

const validOrder = {
  clienteId: id,
  vehiculoId: secondId,
  citaId: null,
  descripcionProblema: ' Ruido al frenar ',
  observaciones: '',
  mecanicoResponsable: '  Carlos  ',
  kilometraje: 85000,
  fechaIngreso: '2026-11-19T10:00:00.000Z',
  idempotencyKey: '7c2ce68d-c0fc-40b5-89b2-fb8a849d7bcb',
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

  it.each(['ADMINISTRADOR', 'RECEPCIONISTA'] as const)(
    'registra órdenes para %s y devuelve el número generado',
    async (role) => {
      const { app, create } = appFor(role)
      const response = await request(app).post('/api/admin/ordenes').send(validOrder)

      expect(response.status).toBe(201)
      expect(response.body.data.numeroOrden).toBe('OT-000001')
      expect(response.body.data.estado).toBe('ABIERTA')
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          descripcionProblema: 'Ruido al frenar',
          observaciones: null,
          mecanicoResponsable: 'Carlos',
          clienteId: id,
          vehiculoId: secondId,
        }),
      )
    },
  )

  it('valida los campos obligatorios en el backend', async () => {
    const { app, create } = appFor('RECEPCIONISTA')
    const response = await request(app)
      .post('/api/admin/ordenes')
      .send({ ...validOrder, descripcionProblema: '  ' })

    expect(response.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('deniega el registro a MECANICO', async () => {
    const { app, create } = appFor('MECANICO')
    const response = await request(app).post('/api/admin/ordenes').send(validOrder)

    expect(response.status).toBe(403)
    expect(create).not.toHaveBeenCalled()
  })

  it('requiere sesión para registrar una orden', async () => {
    const response = await request(createApp()).post('/api/admin/ordenes').send(validOrder)

    expect(response.status).toBe(401)
  })

  it('responde con la orden existente cuando se repite una solicitud idempotente', async () => {
    const { app, create } = appFor('RECEPCIONISTA')
    create.mockImplementationOnce(async (input) => ({
      order: {
        id,
        numeroOrden: 'OT-000001',
        clienteId: input.clienteId,
        vehiculoId: input.vehiculoId,
        citaId: input.citaId,
        descripcionProblema: input.descripcionProblema,
        observaciones: input.observaciones,
        mecanicoResponsable: input.mecanicoResponsable,
        kilometraje: input.kilometraje,
        estado: 'ABIERTA',
        fechaIngreso: input.fechaIngreso,
        fechaCreacion: input.fechaIngreso,
        fechaActualizacion: input.fechaIngreso,
        cliente: { name: 'Johan Moreno', phone: '97000000' },
        vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: null },
      },
      duplicate: true,
    }))
    const response = await request(app).post('/api/admin/ordenes').send(validOrder)

    expect(response.status).toBe(200)
    expect(response.body.data.numeroOrden).toBe('OT-000001')
  })

  it('busca clientes y consulta únicamente citas del vehículo seleccionado', async () => {
    const { app, customers, appointments } = appFor('RECEPCIONISTA')
    const customerResponse = await request(app).get('/api/admin/ordenes/clientes?q=Johan')
    const appointmentResponse = await request(app).get(
      `/api/admin/ordenes/citas?clienteId=${id}&vehiculoId=${secondId}`,
    )

    expect(customerResponse.status).toBe(200)
    expect(customers).toHaveBeenCalledWith('Johan')
    expect(appointmentResponse.status).toBe(200)
    expect(appointments).toHaveBeenCalledWith(id, secondId)
  })
})
