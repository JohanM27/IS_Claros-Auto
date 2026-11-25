import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAdminInventorySummary, getAdminWorkOrders } from './api'

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
