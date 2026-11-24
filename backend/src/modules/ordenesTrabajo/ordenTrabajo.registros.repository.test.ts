import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '../../generated/prisma/client.js'
import { calcularSubtotal, guardarDiagnostico } from './ordenTrabajo.registros.repository.js'

describe('registros de órdenes de trabajo', () => {
  it('calcula importes con Decimal y redondea cada subtotal a centavos', () => {
    expect(calcularSubtotal(new Prisma.Decimal('2.50'), new Prisma.Decimal('10.10'))).toBe('25.25')
    expect(calcularSubtotal(new Prisma.Decimal('0.03'), new Prisma.Decimal('0.15'))).toBe('0.00')
    expect(calcularSubtotal(new Prisma.Decimal('0.05'), new Prisma.Decimal('0.15'))).toBe('0.01')
  })

  it('guarda el diagnóstico y su actor en la misma secuencia de auditoría', async () => {
    const created = {
      id: 'diagnosis-1',
      ordenTrabajoId: 'order-1',
      diagnostico: 'Pastillas desgastadas',
      causaIdentificada: 'Desgaste normal',
      recomendaciones: 'Reemplazar pastillas',
      observaciones: null,
      usuarioRegistroId: 'staff-1',
      usuarioActualizacionId: 'staff-1',
    }
    const historyCreate = vi.fn(async () => ({}))
    const transaction = {
      $queryRaw: vi.fn(async () => []),
      workOrder: {
        findUnique: vi.fn(async () => ({
          id: 'order-1',
          estado: 'EN_DIAGNOSTICO',
          mecanicoResponsable: 'Carlos',
        })),
      },
      diagnosticoOrden: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => created),
        findUniqueOrThrow: vi.fn(async () => created),
      },
      diagnosticoOrdenHistory: { create: historyCreate },
      workOrderRecordHistory: { create: historyCreate },
    } as unknown as Prisma.TransactionClient
    const runner = async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) =>
      operation(transaction)

    const result = await guardarDiagnostico(
      {
        ordenTrabajoId: 'order-1',
        diagnostico: 'Pastillas desgastadas',
        causaIdentificada: 'Desgaste normal',
        recomendaciones: 'Reemplazar pastillas',
        observaciones: null,
        usuarioId: 'staff-1',
      },
      runner,
    )

    expect(result.diagnostico).toBe('Pastillas desgastadas')
    expect(transaction.diagnosticoOrden.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ordenTrabajoId: 'order-1', usuarioRegistroId: 'staff-1' }),
    })
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'DIAGNOSTICO',
        accion: 'CREADO',
        usuarioId: 'staff-1',
      }),
    })
  })

  it.each(['FINALIZADA', 'CANCELADA'] as const)(
    'bloquea escritura del diagnóstico cuando la orden está %s',
    async (estado) => {
      const transaction = {
        $queryRaw: vi.fn(async () => []),
        workOrder: {
          findUnique: vi.fn(async () => ({ id: 'order-1', estado, mecanicoResponsable: null })),
        },
      } as unknown as Prisma.TransactionClient
      const runner = async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) =>
        operation(transaction)

      await expect(
        guardarDiagnostico(
          {
            ordenTrabajoId: 'order-1',
            diagnostico: 'No debe guardar',
            causaIdentificada: null,
            recomendaciones: null,
            observaciones: null,
            usuarioId: 'staff-1',
          },
          runner,
        ),
      ).rejects.toMatchObject({ code: 'WORK_ORDER_CLOSED', status: 409 })
    },
  )
})
