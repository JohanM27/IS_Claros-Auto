import { createHash } from 'node:crypto'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { consultarSolicitudCita, registrarSolicitudCita } from './cita.service.js'
import type { CrearCitaInput } from './cita.schema.js'

const appointmentId = '5a0ac46b-a8ea-4f19-9cf3-1596c3a202de'
const customerFields = {
  name: 'María López',
  phone: '+504 9999 0000',
  email: 'maria@example.com',
  vehicleMake: 'Toyota',
  vehicleModel: 'Corolla',
  vehicleYear: 2020,
  serviceId: 'service-1',
  requestedAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  notes: 'Revisar los frenos.',
}

function createTestApp() {
  let storedTokenHash: string | null = null
  const appointment = {
    id: appointmentId,
    status: 'PENDIENTE',
    requestedAt: new Date(customerFields.requestedAt),
    createdAt: new Date('2026-11-17T12:00:00.000Z'),
    service: { id: 'service-1', name: 'Cambio de aceite' },
  }

  const app = createApp({
    listarServicios: async () => [
      {
        id: 'service-1',
        slug: 'cambio-aceite',
        name: 'Cambio de aceite',
        description: 'Servicio de aceite y filtro.',
      },
    ],
    registrarCita: (input: CrearCitaInput) =>
      registrarSolicitudCita(input, async (_parsedInput, tokenHash) => {
        storedTokenHash = tokenHash
        return appointment
      }),
    consultarCita: (id, token) =>
      consultarSolicitudCita(
        id,
        token,
        async () => ({
          id: appointment.id,
          status: appointment.status,
          requestedAt: appointment.requestedAt,
          createdAt: appointment.createdAt,
          service: { name: appointment.service.name },
        }),
        async () => storedTokenHash,
      ),
  })

  return { app, getStoredTokenHash: () => storedTokenHash }
}

describe('API de solicitudes de citas', () => {
  it('devuelve los servicios activos disponibles', async () => {
    const { app } = createTestApp()
    const response = await request(app).get('/api/servicios')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].slug).toBe('cambio-aceite')
  })

  it('rechaza campos obligatorios y fechas mal formadas', async () => {
    const { app } = createTestApp()
    const response = await request(app)
      .post('/api/citas')
      .send({ ...customerFields, phone: '---', requestedAt: 'mañana' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(response.body.error.details.fieldErrors).toHaveProperty('phone')
    expect(response.body.error.details.fieldErrors).toHaveProperty('requestedAt')
  })

  it('registra una solicitud como pendiente y limita su respuesta al cliente', async () => {
    const { app } = createTestApp()
    const response = await request(app).post('/api/citas').send(customerFields)

    expect(response.status).toBe(201)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.data.status).toBe('PENDIENTE')
    expect(response.body.data.lookupToken).toMatch(/^[a-f0-9]{64}$/)
    expect(response.body.data).not.toHaveProperty('customer')
  })

  it('rechaza una fecha solicitada que ya pasó', async () => {
    const { app } = createTestApp()
    const response = await request(app)
      .post('/api/citas')
      .send({ ...customerFields, requestedAt: '2020-01-01T10:00:00.000Z' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_DATE')
    expect(response.body.error.details.fieldErrors).toHaveProperty('requestedAt')
  })

  it('requiere token y no expone datos personales al consultar la cita', async () => {
    const { app, getStoredTokenHash } = createTestApp()
    const created = await request(app).post('/api/citas').send(customerFields)
    const token = created.body.data.lookupToken as string
    const missingToken = await request(app).get(`/api/citas/${appointmentId}`)
    const valid = await request(app)
      .get(`/api/citas/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(missingToken.status).toBe(401)
    expect(valid.status).toBe(200)
    expect(valid.headers['cache-control']).toBe('no-store')
    expect(valid.body.data.status).toBe('PENDIENTE')
    expect(valid.body.data).not.toHaveProperty('name')
    expect(valid.body.data).not.toHaveProperty('phone')
    expect(valid.body.data).not.toHaveProperty('email')
    expect(createHash('sha256').update(token).digest('hex')).toBe(getStoredTokenHash())
  })

  it('oculta si el token incorrecto corresponde a una cita existente', async () => {
    const { app } = createTestApp()
    await request(app).post('/api/citas').send(customerFields)
    const response = await request(app)
      .get(`/api/citas/${appointmentId}`)
      .set('Authorization', `Bearer ${'b'.repeat(64)}`)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('APPOINTMENT_NOT_FOUND')
  })

  it('aplica límite al endpoint de registro', async () => {
    const { app } = createTestApp()
    let response
    for (let index = 0; index < 11; index += 1) {
      response = await request(app).post('/api/citas').send({})
    }

    expect(response?.status).toBe(429)
    expect(response?.body.error.code).toBe('RATE_LIMITED')
  })

  it('rechaza JSON mal formado con una respuesta segura', async () => {
    const { app } = createTestApp()
    const response = await request(app)
      .post('/api/citas')
      .set('Content-Type', 'application/json')
      .send('{')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_JSON')
  })
})
