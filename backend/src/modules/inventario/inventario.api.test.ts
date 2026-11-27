import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'
import { HttpError } from '../../utils/httpError.js'

const userId = '5a0ac46b-a8ea-4f19-9cf3-1596c3a202de'
const summary = {
  totalRepuestos: 12,
  productosActivos: 10,
  productosStockBajo: 2,
  productosAgotados: 1,
}
const category = {
  id: '73d1c6fd-4f57-46bb-a807-eac572482125',
  nombre: 'Filtros',
  descripcion: 'Filtros de aceite y aire',
  activo: true,
  fechaCreacion: new Date('2026-11-24T12:00:00.000Z'),
  fechaActualizacion: new Date('2026-11-24T12:00:00.000Z'),
  _count: { repuestos: 3 },
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

function categoryAppFor(
  role: 'ADMINISTRADOR' | 'RECEPCIONISTA' | 'MECANICO' | null,
  overrides: Record<string, ReturnType<typeof vi.fn>> = {},
) {
  const functions = {
    listCategories: vi.fn(async () => ({
      data: [category],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    })),
    getCategory: vi.fn(async () => category),
    createCategory: vi.fn(async () => category),
    updateCategory: vi.fn(async () => category),
    setCategoryActive: vi.fn(async (_id: string, activo: boolean) => ({ ...category, activo })),
    ...overrides,
  }
  const app = createApp({
    authenticateEmployee: (request, _response, next) => {
      if (role) request.employeeIdentity = { userId, email: null, displayName: null, role }
      next()
    },
    inventario: functions,
  })
  return { app, functions }
}

describe('API de categorías de inventario', () => {
  it('crea categorías con respuesta 201 para administración', async () => {
    const { app, functions } = categoryAppFor('ADMINISTRADOR')
    const response = await request(app)
      .post('/api/admin/inventario/categorias')
      .send({ nombre: '  Filtros  ', descripcion: '  Aceite y aire  ' })

    expect(response.status).toBe(201)
    expect(response.body.data.nombre).toBe('Filtros')
    expect(functions.createCategory).toHaveBeenCalledWith({
      nombre: 'Filtros',
      descripcion: 'Aceite y aire',
    })
  })

  it('rechaza nombres vacíos y solicitudes con campos no permitidos', async () => {
    const { app, functions } = categoryAppFor('ADMINISTRADOR')
    const empty = await request(app).post('/api/admin/inventario/categorias').send({ nombre: '  ' })
    const extra = await request(app)
      .post('/api/admin/inventario/categorias')
      .send({ nombre: 'Frenos', activo: false })

    expect(empty.status).toBe(400)
    expect(extra.status).toBe(400)
    expect(functions.createCategory).not.toHaveBeenCalled()
  })

  it('permite a recepción consultar solo categorías activas', async () => {
    const { app, functions } = categoryAppFor('RECEPCIONISTA')
    const response = await request(app).get('/api/admin/inventario/categorias?estado=INACTIVAS')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(functions.listCategories).toHaveBeenCalledWith(
      { q: undefined, estado: 'INACTIVAS', page: 1, pageSize: 10 },
      true,
    )
  })

  it('envía búsqueda, estado y paginación a la consulta del backend', async () => {
    const { app, functions } = categoryAppFor('ADMINISTRADOR')
    const response = await request(app).get(
      '/api/admin/inventario/categorias?q=filtro&estado=ACTIVAS&page=2&pageSize=10',
    )

    expect(response.status).toBe(200)
    expect(response.body.pagination.totalPages).toBe(1)
    expect(functions.listCategories).toHaveBeenCalledWith(
      { q: 'filtro', estado: 'ACTIVAS', page: 2, pageSize: 10 },
      false,
    )
  })

  it('rechaza parámetros de consulta inválidos', async () => {
    const { app, functions } = categoryAppFor('ADMINISTRADOR')
    const response = await request(app).get('/api/admin/inventario/categorias?page=0')

    expect(response.status).toBe(400)
    expect(functions.listCategories).not.toHaveBeenCalled()
  })

  it('consulta el detalle existente y valida el UUID', async () => {
    const { app, functions } = categoryAppFor('ADMINISTRADOR')
    const found = await request(app).get(`/api/admin/inventario/categorias/${category.id}`)
    const invalid = await request(app).get('/api/admin/inventario/categorias/no-es-uuid')

    expect(found.status).toBe(200)
    expect(found.body.data._count.repuestos).toBe(3)
    expect(functions.getCategory).toHaveBeenCalledWith(category.id)
    expect(invalid.status).toBe(400)
  })

  it('edita nombre y descripción sin aceptar cambios de identificador', async () => {
    const { app, functions } = categoryAppFor('ADMINISTRADOR')
    const changed = await request(app)
      .patch(`/api/admin/inventario/categorias/${category.id}`)
      .send({ nombre: 'Filtros de motor', descripcion: 'Actualizada' })
    const invalid = await request(app)
      .patch(`/api/admin/inventario/categorias/${category.id}`)
      .send({ id: 'otro-id' })

    expect(changed.status).toBe(200)
    expect(functions.updateCategory).toHaveBeenCalledWith(category.id, {
      nombre: 'Filtros de motor',
      descripcion: 'Actualizada',
    })
    expect(invalid.status).toBe(400)
  })

  it('desactiva y reactiva categorías por el endpoint de estado', async () => {
    const { app } = categoryAppFor('ADMINISTRADOR')
    const inactive = await request(app)
      .patch(`/api/admin/inventario/categorias/${category.id}/estado`)
      .send({ activo: false })
    const active = await request(app)
      .patch(`/api/admin/inventario/categorias/${category.id}/estado`)
      .send({ activo: true })

    expect(inactive.status).toBe(200)
    expect(inactive.body.data.activo).toBe(false)
    expect(active.status).toBe(200)
    expect(active.body.data.activo).toBe(true)
  })

  it('rechaza escritura a recepción y categorías no autorizadas a mecánicos', async () => {
    const receptionist = categoryAppFor('RECEPCIONISTA')
    const mechanic = categoryAppFor('MECANICO')
    const write = await request(receptionist.app)
      .post('/api/admin/inventario/categorias')
      .send({ nombre: 'Frenos' })
    const read = await request(mechanic.app).get('/api/admin/inventario/categorias')
    const noSession = categoryAppFor(null)
    const anonymous = await request(noSession.app).get('/api/admin/inventario/categorias')

    expect(write.status).toBe(403)
    expect(read.status).toBe(403)
    expect(anonymous.status).toBe(401)
    expect(receptionist.functions.createCategory).not.toHaveBeenCalled()
  })

  it('oculta a recepción una categoría inactiva como inexistente', async () => {
    const receptionist = categoryAppFor('RECEPCIONISTA', {
      getCategory: vi.fn(async () => ({ ...category, activo: false })),
    })
    const response = await request(receptionist.app).get(
      `/api/admin/inventario/categorias/${category.id}`,
    )

    expect(response.status).toBe(404)
  })

  it('propaga el conflicto de categoría con repuestos activos sin revelar datos internos', async () => {
    const admin = categoryAppFor('ADMINISTRADOR', {
      setCategoryActive: vi.fn(async () => {
        throw new HttpError(
          409,
          'CATEGORY_HAS_ACTIVE_PRODUCTS',
          'No se puede desactivar: la categoría tiene repuestos activos asociados.',
        )
      }),
    })
    const response = await request(admin.app)
      .patch(`/api/admin/inventario/categorias/${category.id}/estado`)
      .send({ activo: false })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toContain('repuestos activos')
    expect(response.body.error.message).not.toContain('Prisma')
  })
})
