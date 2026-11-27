import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  categoriaRepuesto: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  repuesto: { count: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../../config/database.js', () => ({ prisma: db }))

import { Prisma } from '../../generated/prisma/client.js'
import { HttpError } from '../../utils/httpError.js'
import {
  actualizarCategoria,
  cambiarEstadoCategoria,
  crearCategoria,
  listarCategorias,
  validarCategoriaActivaParaRepuesto,
} from './categorias.repository.js'

const categoryId = '73d1c6fd-4f57-46bb-a807-eac572482125'
const category = {
  id: categoryId,
  nombre: 'Filtros',
  descripcion: null,
  activo: true,
  fechaCreacion: new Date('2026-11-24T12:00:00.000Z'),
  fechaActualizacion: new Date('2026-11-24T12:00:00.000Z'),
  _count: { repuestos: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('persistencia de categorías', () => {
  it('consulta una página ordenada y cuenta relaciones en la base de datos', async () => {
    db.categoriaRepuesto.count.mockResolvedValue(13)
    db.categoriaRepuesto.findMany.mockResolvedValue([category])

    const response = await listarCategorias(
      { q: 'filtro', estado: 'ACTIVAS', page: 2, pageSize: 10 },
      false,
    )

    expect(response.pagination).toEqual({ page: 2, pageSize: 10, total: 13, totalPages: 2 })
    expect(response.data).toEqual([category])
    expect(db.categoriaRepuesto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        where: { activo: true, nombre: { contains: 'filtro', mode: 'insensitive' } },
        select: expect.objectContaining({ _count: { select: { repuestos: true } } }),
      }),
    )
  })

  it('normaliza el nombre persistido y deja activo el valor predeterminado', async () => {
    db.categoriaRepuesto.create.mockResolvedValue(category)

    await crearCategoria({ nombre: '  Filtros   de ACEITE ', descripcion: '   ' })

    expect(db.categoriaRepuesto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          nombre: 'Filtros de ACEITE',
          nombreNormalizado: 'filtros de aceite',
          descripcion: null,
        },
      }),
    )
  })

  it('traduce una colisión única concurrente en HTTP 409', async () => {
    db.categoriaRepuesto.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate key', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )

    await expect(crearCategoria({ nombre: 'filtros' })).rejects.toMatchObject({
      status: 409,
      code: 'CATEGORY_NAME_EXISTS',
    })
  })

  it('edita nombre y descripción sin sustituir el ID ni tocar repuestos', async () => {
    db.categoriaRepuesto.updateMany.mockResolvedValue({ count: 1 })
    db.categoriaRepuesto.findUnique.mockResolvedValue(category)

    await actualizarCategoria(categoryId, {
      nombre: 'Filtros de motor',
      descripcion: 'Para motor',
    })

    expect(db.categoriaRepuesto.updateMany).toHaveBeenCalledWith({
      where: { id: categoryId },
      data: {
        nombre: 'Filtros de motor',
        nombreNormalizado: 'filtros de motor',
        descripcion: 'Para motor',
      },
    })
    expect(db.categoriaRepuesto.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: categoryId } }),
    )
  })

  it('devuelve 404 al editar una categoría inexistente', async () => {
    db.categoriaRepuesto.updateMany.mockResolvedValue({ count: 0 })

    await expect(actualizarCategoria(categoryId, { nombre: 'Nueva' })).rejects.toMatchObject({
      status: 404,
      code: 'CATEGORY_NOT_FOUND',
    })
  })

  it('no desactiva categorías con repuestos activos asociados', async () => {
    const transaction = {
      categoriaRepuesto: {
        findUnique: vi.fn().mockResolvedValue({ activo: true }),
        updateMany: vi.fn(),
      },
      repuesto: { count: vi.fn().mockResolvedValue(2) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: categoryId }]),
    }
    db.$transaction.mockImplementation((operation: (tx: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
    )

    await expect(cambiarEstadoCategoria(categoryId, false)).rejects.toMatchObject({
      status: 409,
      code: 'CATEGORY_HAS_ACTIVE_PRODUCTS',
    })
    expect(transaction.categoriaRepuesto.updateMany).not.toHaveBeenCalled()
  })

  it('desactiva bajo bloqueo serializable cuando no hay repuestos activos', async () => {
    const transaction = {
      categoriaRepuesto: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ activo: true })
          .mockResolvedValueOnce({
            ...category,
            activo: false,
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      repuesto: { count: vi.fn().mockResolvedValue(0) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: categoryId }]),
    }
    db.$transaction.mockImplementation((operation: (tx: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
    )

    const result = await cambiarEstadoCategoria(categoryId, false)

    expect(result.activo).toBe(false)
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1)
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('permite reactivar una categoría y bloquea nuevos repuestos en categoría inactiva', async () => {
    const transaction = {
      categoriaRepuesto: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ activo: false })
          .mockResolvedValueOnce({
            ...category,
            activo: true,
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      repuesto: { count: vi.fn() },
      $queryRaw: vi.fn(),
    }
    db.$transaction.mockImplementation((operation: (tx: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
    )
    const result = await cambiarEstadoCategoria(categoryId, true)
    expect(result.activo).toBe(true)

    const categoryLookup = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: categoryId }]),
      categoriaRepuesto: { findUnique: vi.fn().mockResolvedValue({ activo: false }) },
    }
    await expect(
      validarCategoriaActivaParaRepuesto(categoryLookup as never, categoryId),
    ).rejects.toMatchObject({ status: 409, code: 'CATEGORY_INACTIVE' })
    expect(categoryLookup.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('devuelve 404 cuando una categoría no existe al intentar cambiar su estado', async () => {
    const transaction = {
      categoriaRepuesto: { findUnique: vi.fn().mockResolvedValue(null) },
      repuesto: { count: vi.fn() },
      $queryRaw: vi.fn(),
    }
    db.$transaction.mockImplementation((operation: (tx: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
    )

    await expect(cambiarEstadoCategoria(categoryId, false)).rejects.toBeInstanceOf(HttpError)
    await expect(cambiarEstadoCategoria(categoryId, false)).rejects.toMatchObject({ status: 404 })
  })
})
