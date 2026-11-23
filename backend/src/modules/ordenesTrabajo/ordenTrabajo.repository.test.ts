import { describe, expect, it } from 'vitest'
import { crearWhereOrdenesTrabajo } from './ordenTrabajo.repository.js'

describe('filtros de órdenes de trabajo', () => {
  it('busca por número de orden, cliente o placa', () => {
    const where = crearWhereOrdenesTrabajo({ q: 'ford', page: 1, pageSize: 10 })
    const search = (where.AND as Array<{ OR?: unknown[] }>)[0]

    expect(search.OR).toHaveLength(3)
    expect(search.OR).toEqual([
      { numeroOrden: { contains: 'ford', mode: 'insensitive' } },
      { cliente: { name: { contains: 'ford', mode: 'insensitive' } } },
      { vehiculo: { plate: { contains: 'ford', mode: 'insensitive' } } },
    ])
  })

  it('combina estado, mecánico y rango inclusivo de fechas', () => {
    const where = crearWhereOrdenesTrabajo({
      estado: 'EN_PROCESO',
      mecanico: 'Carlos',
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      page: 2,
      pageSize: 10,
    })
    const filters = where.AND as Array<Record<string, unknown>>

    expect(filters).toHaveLength(3)
    expect(filters[0]).toEqual({ estado: 'EN_PROCESO' })
    expect(filters[1]).toEqual({
      mecanicoResponsable: { contains: 'Carlos', mode: 'insensitive' },
    })
    expect(filters[2]).toEqual({
      fechaIngreso: {
        gte: new Date('2026-11-01T00:00:00.000Z'),
        lt: new Date('2026-12-01T00:00:00.000Z'),
      },
    })
  })
})
