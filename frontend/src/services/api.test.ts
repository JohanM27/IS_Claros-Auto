import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createInventoryCategory,
  getAdminInventorySummary,
  getAdminWorkOrders,
  getInventoryCategories,
  setInventoryCategoryActive,
  updateInventoryCategory,
} from './api'

afterEach(() => vi.unstubAllGlobals())

describe('servicio de listado de órdenes', () => {
  it('conserva la paginación que acompaña a data en la respuesta del backend', async () => {
    const page = {
      data: [],
      pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => page,
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getAdminWorkOrders('access-token', { estado: 'ABIERTA', page: 2, pageSize: 10 }),
    ).resolves.toEqual(page)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/ordenes?estado=ABIERTA&page=2&pageSize=10',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    )
  })
})

describe('servicio de resumen de inventario', () => {
  it('consulta el endpoint administrativo con la sesión del empleado', async () => {
    const summary = {
      totalRepuestos: 2,
      productosActivos: 2,
      productosStockBajo: 1,
      productosAgotados: 0,
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: summary }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getAdminInventorySummary('access-token')).resolves.toEqual(summary)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/inventario/resumen',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    )
  })
})

describe('servicios de categorías de inventario', () => {
  it('solicita listado paginado con filtros y conserva la metadata', async () => {
    const page = {
      data: [],
      pagination: { page: 2, pageSize: 10, total: 12, totalPages: 2 },
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => page,
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getInventoryCategories('access-token', {
        q: 'filtro',
        estado: 'ACTIVAS',
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toEqual(page)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/inventario/categorias?q=filtro&estado=ACTIVAS&page=2&pageSize=10',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    )
  })

  it('crea, edita y cambia el estado con los verbos y rutas protegidas', async () => {
    const category = { id: 'category-id', nombre: 'Frenos', activo: true }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: category }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createInventoryCategory('access-token', { nombre: 'Frenos', descripcion: null })
    await updateInventoryCategory('access-token', 'category-id', { nombre: 'Frenos delanteros' })
    await setInventoryCategoryActive('access-token', 'category-id', false)

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      [
        '/api/admin/inventario/categorias',
        'POST',
        JSON.stringify({ nombre: 'Frenos', descripcion: null }),
      ],
      [
        '/api/admin/inventario/categorias/category-id',
        'PATCH',
        JSON.stringify({ nombre: 'Frenos delanteros' }),
      ],
      [
        '/api/admin/inventario/categorias/category-id/estado',
        'PATCH',
        JSON.stringify({ activo: false }),
      ],
    ])
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer access-token')
    }
  })
})
