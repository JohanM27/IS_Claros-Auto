import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'

const userId = '5a0ac46b-a8ea-4f19-9cf3-1596c3a202de'
const summary = {
  totalRepuestos: 12,
  productosActivos: 10,
  productosStockBajo: 2,
  productosAgotados: 1,
}

function appFor(role: 'ADMINISTRADOR' | 'RECEPCIONISTA' | 'MECANICO' | null) {
  const getSummary = vi.fn(async (includeCosts: boolean) =>
    includeCosts ? { ...summary, valorInventario: '3450.75' } : summary,
  )
  return {
    app: createApp({
      authenticateEmployee: (request, _response, next) => {
        if (role) {
          request.employeeIdentity = { userId, email: null, displayName: null, role }
        }
        next()
      },
      inventario: { getSummary },
    }),
    getSummary,
  }
}

describe('API de resumen de inventario', () => {
  it('devuelve métricas reales sin caché y reserva el valor a administración', async () => {
    const { app, getSummary } = appFor('ADMINISTRADOR')
    const response = await request(app).get('/api/admin/inventario/resumen')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.data).toEqual({ ...summary, valorInventario: '3450.75' })
    expect(getSummary).toHaveBeenCalledWith(true)
  })

  it('permite a recepción consultar cantidades sin recibir costos de compra', async () => {
    const { app, getSummary } = appFor('RECEPCIONISTA')
    const response = await request(app).get('/api/admin/inventario/resumen')

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(summary)
    expect(response.body.data.valorInventario).toBeUndefined()
    expect(getSummary).toHaveBeenCalledWith(false)
  })

  it('requiere sesión y bloquea a los mecánicos', async () => {
    const unauthenticated = appFor(null)
    const denied = appFor('MECANICO')

    expect((await request(unauthenticated.app).get('/api/admin/inventario/resumen')).status).toBe(
      401,
    )
    expect((await request(denied.app).get('/api/admin/inventario/resumen')).status).toBe(403)
  })
})
