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

const part = {
  id: 'a4f76ce5-b2ee-4d3e-b8b1-d85768831e6d',
  sku: 'REP-00001',
  codigoBarras: '001234',
  nombre: 'Filtro de aceite',
  descripcion: null,
  categoriaId: category.id,
  categoria: { id: category.id, nombre: category.nombre, activo: true },
  marca: 'ACME',
  numeroParte: '001-A',
  unidadMedida: 'UNIDAD',
  precioVenta: '180.00',
  stockActual: '0.000',
  stockMinimo: '2.000',
  activo: true,
  fechaCreacion: new Date('2026-11-24T12:00:00.000Z'),
  fechaActualizacion: new Date('2026-11-24T12:00:00.000Z'),
}

function partsAppFor(
  role: 'ADMINISTRADOR' | 'RECEPCIONISTA' | 'MECANICO' | null,
  overrides: Record<string, ReturnType<typeof vi.fn>> = {},
) {
  const functions = {
    listParts: vi.fn(async (_filters, includeCosts: boolean) => ({
      data: [includeCosts ? { ...part, precioCompra: '125.50' } : part],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    })),
    getPart: vi.fn(async (_id: string, includeCosts: boolean) =>
      includeCosts ? { ...part, precioCompra: '125.50' } : part,
    ),
    createPart: vi.fn(async () => ({ ...part, precioCompra: '125.50' })),
    updatePart: vi.fn(async () => ({ ...part, precioCompra: '125.50' })),
    setPartActive: vi.fn(async (_id: string, activo: boolean) => ({
      ...part,
      activo,
      precioCompra: '125.50',
    })),
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

describe('API de repuestos de inventario', () => {
  it('lista y pagina repuestos, dando prioridad a permisos de costo del administrador', async () => {
    const admin = partsAppFor('ADMINISTRADOR')
    const response = await request(admin.app).get(
      '/api/admin/inventario/repuestos?q=REP-00001&page=2',
    )
    expect(response.status).toBe(200)
    expect(response.body.data[0].precioCompra).toBe('125.50')
    expect(response.body.pagination.page).toBe(1)
    expect(admin.functions.listParts).toHaveBeenCalledWith(
      {
        q: 'REP-00001',
        categoriaId: undefined,
        marca: undefined,
        estado: 'ACTIVOS',
        page: 2,
        pageSize: 10,
      },
      true,
      false,
    )
  })

  it('limita recepción a productos activos y no devuelve campos de costos', async () => {
    const receptionist = partsAppFor('RECEPCIONISTA')
    const response = await request(receptionist.app).get(
      '/api/admin/inventario/repuestos?estado=INACTIVOS',
    )
    expect(response.status).toBe(200)
    expect(response.body.data[0].precioCompra).toBeUndefined()
    expect(receptionist.functions.listParts).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'INACTIVOS' }),
      false,
      true,
    )
  })

  it('rechaza filtros inválidos y perfiles sin permisos de lectura', async () => {
    const admin = partsAppFor('ADMINISTRADOR')
    const mechanic = partsAppFor('MECANICO')
    const anonymous = partsAppFor(null)
    expect(
      (await request(admin.app).get('/api/admin/inventario/repuestos?pageSize=100')).status,
    ).toBe(400)
    expect((await request(mechanic.app).get('/api/admin/inventario/repuestos')).status).toBe(403)
    expect((await request(anonymous.app).get('/api/admin/inventario/repuestos')).status).toBe(401)
  })

  it('consulta detalle con UUID válido y oculta productos inactivos a recepción', async () => {
    const admin = partsAppFor('ADMINISTRADOR')
    expect(
      (await request(admin.app).get(`/api/admin/inventario/repuestos/${part.id}`)).body.data
        .precioCompra,
    ).toBe('125.50')
    expect((await request(admin.app).get('/api/admin/inventario/repuestos/no-valido')).status).toBe(
      400,
    )
    const hidden = partsAppFor('RECEPCIONISTA', { getPart: vi.fn(async () => null) })
    expect(
      (await request(hidden.app).get(`/api/admin/inventario/repuestos/${part.id}`)).status,
    ).toBe(404)
  })

  it('registra sin aceptar SKU ni existencias desde el cliente', async () => {
    const admin = partsAppFor('ADMINISTRADOR')
    const input = {
      claveIdempotencia: '1218d43a-1e71-4f80-aef0-227d53d52968',
      nombre: 'Filtro',
      categoriaId: category.id,
      precioCompra: '12.50',
      precioVenta: '19.99',
    }
    const saved = await request(admin.app).post('/api/admin/inventario/repuestos').send(input)
    const injectedStock = await request(admin.app)
      .post('/api/admin/inventario/repuestos')
      .send({ ...input, stockActual: '5' })
    const injectedSku = await request(admin.app)
      .post('/api/admin/inventario/repuestos')
      .send({ ...input, sku: 'REP-99999' })
    expect(saved.status).toBe(201)
    expect(saved.body.data.sku).toBe('REP-00001')
    expect(admin.functions.createPart).toHaveBeenCalledWith(
      expect.objectContaining({
        claveIdempotencia: '1218d43a-1e71-4f80-aef0-227d53d52968',
        precioCompra: '12.50',
      }),
    )
    expect(injectedStock.status).toBe(400)
    expect(injectedSku.status).toBe(400)
    expect(admin.functions.createPart).toHaveBeenCalledTimes(1)
  })

  it('no permite alta a recepción ni a perfiles no autorizados', async () => {
    const receptionist = partsAppFor('RECEPCIONISTA')
    const mechanic = partsAppFor('MECANICO')
    expect(
      (await request(receptionist.app).post('/api/admin/inventario/repuestos').send({})).status,
    ).toBe(403)
    expect(
      (await request(mechanic.app).post('/api/admin/inventario/repuestos').send({})).status,
    ).toBe(403)
  })

  it('edita solo campos permitidos y bloquea cambios de SKU y stock', async () => {
    const admin = partsAppFor('ADMINISTRADOR')
    const updated = await request(admin.app)
      .patch(`/api/admin/inventario/repuestos/${part.id}`)
      .send({ precioVenta: '199.99' })
    const sku = await request(admin.app)
      .patch(`/api/admin/inventario/repuestos/${part.id}`)
      .send({ sku: 'REP-00002' })
    const stock = await request(admin.app)
      .patch(`/api/admin/inventario/repuestos/${part.id}`)
      .send({ stockActual: '4' })
    expect(updated.status).toBe(200)
    expect(admin.functions.updatePart).toHaveBeenCalledWith(
      part.id,
      { precioVenta: '199.99' },
      true,
    )
    expect(sku.status).toBe(400)
    expect(stock.status).toBe(400)
  })

  it('desactiva y reactiva productos mediante el endpoint protegido', async () => {
    const admin = partsAppFor('ADMINISTRADOR')
    const inactive = await request(admin.app)
      .patch(`/api/admin/inventario/repuestos/${part.id}/estado`)
      .send({ activo: false })
    const active = await request(admin.app)
      .patch(`/api/admin/inventario/repuestos/${part.id}/estado`)
      .send({ activo: true })
    const denied = partsAppFor('RECEPCIONISTA')
    expect(inactive.body.data.activo).toBe(false)
    expect(active.body.data.activo).toBe(true)
    expect(
      (
        await request(denied.app)
          .patch(`/api/admin/inventario/repuestos/${part.id}/estado`)
          .send({ activo: false })
      ).status,
    ).toBe(403)
  })
})

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
