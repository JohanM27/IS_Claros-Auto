import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '../../generated/prisma/client.js'
import { crearWhereOrdenesTrabajo, cambiarEstadoOrdenTrabajo } from './ordenTrabajo.repository.js'

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

describe('actualización transaccional de estado', () => {
  function createHarness(options: { historyFails?: boolean; updateCount?: number } = {}) {
    let persistedState = 'ABIERTA'
    let persistedHistory: unknown[] = []
    const transaction = {
      workOrder: {
        findUnique: vi.fn(async () => ({ estado: persistedState })),
        updateMany: vi.fn(async ({ data }: { data: { estado: string } }) => {
          if (options.updateCount === 0) return { count: 0 }
          persistedState = data.estado
          return { count: 1 }
        }),
        findUniqueOrThrow: vi.fn(async () => ({ id: 'order-1', estado: persistedState })),
      },
      workOrderStatusHistory: {
        create: vi.fn(async ({ data }: { data: unknown }) => {
          if (options.historyFails) throw new Error('audit insert failed')
          persistedHistory = [...persistedHistory, data]
          return data
        }),
      },
    } as unknown as Prisma.TransactionClient

    const transactionRunner = async <T>(
      operation: (client: Prisma.TransactionClient) => Promise<T>,
    ) => {
      const previousState = persistedState
      const previousHistory = [...persistedHistory]
      try {
        return await operation(transaction)
      } catch (error) {
        persistedState = previousState
        persistedHistory = previousHistory
        throw error
      }
    }

    return {
      transaction,
      transactionRunner,
      readState: () => persistedState,
      readHistory: () => persistedHistory,
    }
  }

  const input = {
    ordenTrabajoId: 'order-1',
    estadoActualEsperado: 'ABIERTA' as const,
    estadoNuevo: 'EN_DIAGNOSTICO' as const,
    observaciones: 'Revisión inicial',
    usuarioId: 'staff-1',
  }

  it('cambia el estado y registra el actor autenticado dentro de una transacción', async () => {
    const harness = createHarness()

    await cambiarEstadoOrdenTrabajo(input, harness.transactionRunner)

    expect(harness.readState()).toBe('EN_DIAGNOSTICO')
    expect(harness.readHistory()).toEqual([
      expect.objectContaining({
        ordenTrabajoId: 'order-1',
        estadoAnterior: 'ABIERTA',
        estadoNuevo: 'EN_DIAGNOSTICO',
        usuarioId: 'staff-1',
      }),
    ])
  })

  it('rechaza una actualización concurrente si el estado ya cambió', async () => {
    const harness = createHarness({ updateCount: 0 })

    await expect(cambiarEstadoOrdenTrabajo(input, harness.transactionRunner)).rejects.toMatchObject(
      {
        code: 'WORK_ORDER_CHANGED_CONCURRENTLY',
      },
    )
    expect(harness.transaction.workOrderStatusHistory.create).not.toHaveBeenCalled()
  })

  it('revierte el cambio de estado cuando falla la escritura del historial', async () => {
    const harness = createHarness({ historyFails: true })

    await expect(cambiarEstadoOrdenTrabajo(input, harness.transactionRunner)).rejects.toThrow(
      'audit insert failed',
    )
    expect(harness.readState()).toBe('ABIERTA')
    expect(harness.readHistory()).toEqual([])
  })
})
