import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'

const id = '5a0ac46b-a8ea-4f19-9cf3-1596c3a202de'
const secondId = '6b1bd57c-b9fb-4b2a-8df4-2607d4b313ef'

function appFor(role: 'ADMINISTRADOR' | 'RECEPCIONISTA' | 'MECANICO') {
  const rows = [
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
  ]
  const list = vi.fn().mockResolvedValue({
    data: rows,
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
  })
  const get = vi.fn().mockResolvedValue({
    id,
    numeroOrden: 'OT-0001',
    clienteId: id,
    vehiculoId: secondId,
    citaId: null,
    descripcionProblema: 'Ruido al frenar',
    observaciones: 'Revisar frenos',
    mecanicoResponsable: 'Carlos Pérez',
    kilometraje: 85000,
    estado: 'ABIERTA',
    fechaIngreso: new Date('2026-11-19T10:00:00.000Z'),
    fechaCreacion: new Date('2026-11-19T10:00:00.000Z'),
    fechaActualizacion: new Date('2026-11-19T10:00:00.000Z'),
    cliente: { name: 'Johan Moreno', phone: '97000000', email: null },
    vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: 'ABC123' },
    cita: null,
  })
  const history = vi.fn().mockResolvedValue([
    {
      id: secondId,
      estadoAnterior: 'ABIERTA',
      estadoNuevo: 'EN_DIAGNOSTICO',
      observaciones: 'Ingreso a diagnóstico',
      fechaCambio: new Date('2026-11-19T11:00:00.000Z'),
      usuario: { userId: id, displayName: 'Johan Moreno' },
    },
  ])
  const changeStatus = vi.fn().mockImplementation(async (input) => ({
    ...(await get()),
    estado: input.estadoNuevo,
  }))
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
    ordenesTrabajo: { list, get, history, changeStatus, create, customers, appointments },
  })
  return { app, list, get, history, changeStatus, create, customers, appointments }
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

  it('requiere sesión para consultar historial y cambiar el estado', async () => {
    const unauthenticated = createApp()
    const historyResponse = await request(unauthenticated).get(`/api/admin/ordenes/${id}/historial`)
    const statusResponse = await request(unauthenticated)
      .patch(`/api/admin/ordenes/${id}/estado`)
      .send({ estadoActual: 'ABIERTA', estado: 'EN_DIAGNOSTICO' })

    expect(historyResponse.status).toBe(401)
    expect(statusResponse.status).toBe(401)
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
        ordenesTrabajo: {
          list: async () => ({
            data: [],
            pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
          }),
        },
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

  it.each(['OT-000001', 'Johan Moreno', 'ABC123'])(
    'filtra por el término de búsqueda %s en el backend paginado',
    async (q) => {
      const { app, list } = appFor('RECEPCIONISTA')
      const response = await request(app).get('/api/admin/ordenes').query({ q })

      expect(response.status).toBe(200)
      expect(response.body.data[0].numeroOrden).toBe('OT-0001')
      expect(response.body.pagination).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 })
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ q, page: 1, pageSize: 10 }))
    },
  )

  it('combina estado, rango de fechas, mecánico, búsqueda y página', async () => {
    const { app, list } = appFor('ADMINISTRADOR')
    const response = await request(app).get('/api/admin/ordenes').query({
      q: 'Ford',
      estado: 'EN_PROCESO',
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      mecanico: 'Carlos',
      page: '3',
      pageSize: '10',
    })

    expect(response.status).toBe(200)
    expect(list).toHaveBeenCalledWith({
      q: 'Ford',
      estado: 'EN_PROCESO',
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      mecanico: 'Carlos',
      page: 3,
      pageSize: 10,
    })
  })

  it('rechaza filtros y paginación fuera de límites', async () => {
    const { app, list } = appFor('RECEPCIONISTA')
    const response = await request(app).get('/api/admin/ordenes?page=0&pageSize=1000')

    expect(response.status).toBe(400)
    expect(list).not.toHaveBeenCalled()
  })

  it('consulta los datos detallados de una orden existente', async () => {
    const { app, get } = appFor('RECEPCIONISTA')
    const response = await request(app).get(`/api/admin/ordenes/${id}`)

    expect(response.status).toBe(200)
    expect(response.body.data.numeroOrden).toBe('OT-0001')
    expect(response.body.data.cliente.email).toBeNull()
    expect(response.body.data.kilometraje).toBe(85000)
    expect(get).toHaveBeenCalledWith(id)
  })

  it('responde 404 si la orden no existe', async () => {
    const response = await request(
      createApp({
        authenticateEmployee: (_request, _response, next) => {
          _request.employeeIdentity = {
            userId: id,
            email: null,
            displayName: null,
            role: 'ADMINISTRADOR',
          }
          next()
        },
        ordenesTrabajo: { get: async () => null },
      }),
    ).get(`/api/admin/ordenes/${secondId}`)

    expect(response.status).toBe(404)
  })

  it('bloquea el detalle para MECANICO', async () => {
    const { app, get } = appFor('MECANICO')
    const response = await request(app).get(`/api/admin/ordenes/${id}`)

    expect(response.status).toBe(403)
    expect(get).not.toHaveBeenCalled()
  })

  it('consulta historial persistido ordenado desde el endpoint protegido', async () => {
    const { app, history } = appFor('RECEPCIONISTA')
    const response = await request(app).get(`/api/admin/ordenes/${id}/historial`)

    expect(response.status).toBe(200)
    expect(response.body.data[0].estadoNuevo).toBe('EN_DIAGNOSTICO')
    expect(history).toHaveBeenCalledWith(id)
  })

  it.each(['ADMINISTRADOR', 'RECEPCIONISTA'] as const)(
    'permite a %s cambiar el estado usando el usuario autenticado',
    async (role) => {
      const { app, changeStatus } = appFor(role)
      const response = await request(app).patch(`/api/admin/ordenes/${id}/estado`).send({
        estadoActual: 'ABIERTA',
        estado: 'EN_DIAGNOSTICO',
        observaciones: 'Revisión inicial',
      })

      expect(response.status).toBe(200)
      expect(response.body.data.estado).toBe('EN_DIAGNOSTICO')
      expect(changeStatus).toHaveBeenCalledWith({
        ordenTrabajoId: id,
        estadoActualEsperado: 'ABIERTA',
        estadoNuevo: 'EN_DIAGNOSTICO',
        observaciones: 'Revisión inicial',
        usuarioId: id,
      })
    },
  )

  it('no acepta un estado inexistente ni un usuario enviado desde el cliente', async () => {
    const { app, changeStatus } = appFor('ADMINISTRADOR')
    const invalidStatus = await request(app)
      .patch(`/api/admin/ordenes/${id}/estado`)
      .send({ estadoActual: 'ABIERTA', estado: 'MECANICO' })
    const spoofedActor = await request(app)
      .patch(`/api/admin/ordenes/${id}/estado`)
      .send({ estadoActual: 'ABIERTA', estado: 'EN_DIAGNOSTICO', usuarioId: secondId })

    expect(invalidStatus.status).toBe(400)
    expect(spoofedActor.status).toBe(400)
    expect(changeStatus).not.toHaveBeenCalled()
  })

  it('exige motivo para cancelar y deniega cambios a MECANICO', async () => {
    const admin = appFor('ADMINISTRADOR')
    const noReason = await request(admin.app)
      .patch(`/api/admin/ordenes/${id}/estado`)
      .send({ estadoActual: 'ABIERTA', estado: 'CANCELADA', observaciones: '  ' })
    const mechanic = appFor('MECANICO')
    const forbidden = await request(mechanic.app)
      .patch(`/api/admin/ordenes/${id}/estado`)
      .send({ estadoActual: 'ABIERTA', estado: 'EN_DIAGNOSTICO' })

    expect(noReason.status).toBe(400)
    expect(admin.changeStatus).not.toHaveBeenCalled()
    expect(forbidden.status).toBe(403)
    expect(mechanic.changeStatus).not.toHaveBeenCalled()
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
