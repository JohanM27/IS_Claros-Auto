import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAdminWorkOrders } from './api'

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
