import { prisma } from '../../config/database.js'
import { Prisma } from '../../generated/prisma/client.js'
import { HttpError } from '../../utils/httpError.js'
import { normalizarNombreCategoria } from './inventario.validation.js'

export type FiltrosCategorias = {
  q?: string
  estado: 'TODAS' | 'ACTIVAS' | 'INACTIVAS'
  page: number
  pageSize: number
}

export type CategoriaInput = { nombre: string; descripcion?: string | null }
export type CategoriaPatchInput = Partial<CategoriaInput>
export type CategoriaItem = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  fechaCreacion: Date
  fechaActualizacion: Date
  _count: { repuestos: number }
}

function toCategoriaConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new HttpError(409, 'CATEGORY_NAME_EXISTS', 'Ya existe una categoría con ese nombre.')
    }
    if (error.code === 'P2034') {
      throw new HttpError(
        409,
        'CATEGORY_CHANGED_CONCURRENTLY',
        'La categoría cambió durante la operación. Actualiza la lista e inténtalo de nuevo.',
      )
    }
  }
  throw error
}

function notFound(): never {
  throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'No se encontró la categoría.')
}

export async function listarCategorias(filters: FiltrosCategorias, soloActivas = false) {
  const where: Prisma.CategoriaRepuestoWhereInput = {}
  const activo = soloActivas
    ? true
    : filters.estado === 'ACTIVAS'
      ? true
      : filters.estado === 'INACTIVAS'
        ? false
        : undefined
  if (activo !== undefined) where.activo = activo
  if (filters.q) where.nombre = { contains: filters.q, mode: 'insensitive' }

  const [total, data] = await Promise.all([
    prisma.categoriaRepuesto.count({ where }),
    prisma.categoriaRepuesto.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        _count: { select: { repuestos: true } },
      },
    }),
  ])

  return {
    data,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  }
}

export function consultarCategoria(id: string): Promise<CategoriaItem | null> {
  return prisma.categoriaRepuesto.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      activo: true,
      fechaCreacion: true,
      fechaActualizacion: true,
      _count: { select: { repuestos: true } },
    },
  })
}

export async function crearCategoria(input: CategoriaInput) {
  try {
    return await prisma.categoriaRepuesto.create({
      data: {
        nombre: input.nombre.trim().normalize('NFKC').replace(/\s+/g, ' '),
        nombreNormalizado: normalizarNombreCategoria(input.nombre),
        descripcion: input.descripcion?.trim() || null,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        _count: { select: { repuestos: true } },
      },
    })
  } catch (error) {
    toCategoriaConflict(error)
  }
}

export async function actualizarCategoria(id: string, input: CategoriaPatchInput) {
  try {
    const update = await prisma.categoriaRepuesto.updateMany({
      where: { id },
      data: {
        ...(input.nombre === undefined
          ? {}
          : {
              nombre: input.nombre.trim().normalize('NFKC').replace(/\s+/g, ' '),
              nombreNormalizado: normalizarNombreCategoria(input.nombre),
            }),
        ...(input.descripcion === undefined
          ? {}
          : { descripcion: input.descripcion?.trim() || null }),
      },
    })
    if (update.count !== 1) notFound()
    return (await consultarCategoria(id)) ?? notFound()
  } catch (error) {
    toCategoriaConflict(error)
  }
}

type CategoryTransaction = Prisma.TransactionClient

/**
 * Lock and verify a category before a future repuesto insert. All product creation flows must call
 * this helper inside the same transaction as the insert to serialize against category deactivation.
 */
export async function validarCategoriaActivaParaRepuesto(
  transaction: CategoryTransaction,
  categoriaId: string,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CategoriaRepuesto" WHERE "id" = ${categoriaId} FOR UPDATE
  `
  if (rows.length === 0) notFound()
  const category = await transaction.categoriaRepuesto.findUnique({
    where: { id: categoriaId },
    select: { activo: true },
  })
  if (!category) notFound()
  if (!category.activo) {
    throw new HttpError(
      409,
      'CATEGORY_INACTIVE',
      'No se pueden asignar repuestos a una categoría inactiva.',
    )
  }
}

export async function cambiarEstadoCategoria(id: string, activo: boolean): Promise<CategoriaItem> {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const category = await transaction.categoriaRepuesto.findUnique({
          where: { id },
          select: { activo: true },
        })
        if (!category) notFound()
        if (category.activo === activo)
          return (await consultarCategoriaEnTx(transaction, id)) ?? notFound()

        if (!activo) {
          await transaction.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "CategoriaRepuesto" WHERE "id" = ${id} FOR UPDATE
          `
          const activeProducts = await transaction.repuesto.count({
            where: { categoriaId: id, activo: true },
          })
          if (activeProducts > 0) {
            throw new HttpError(
              409,
              'CATEGORY_HAS_ACTIVE_PRODUCTS',
              'No se puede desactivar: la categoría tiene repuestos activos asociados.',
            )
          }
        }

        const changed = await transaction.categoriaRepuesto.updateMany({
          where: { id, activo: category.activo },
          data: { activo },
        })
        if (changed.count !== 1) {
          throw new HttpError(
            409,
            'CATEGORY_CHANGED_CONCURRENTLY',
            'La categoría cambió durante la operación. Actualiza la lista e inténtalo de nuevo.',
          )
        }
        return (await consultarCategoriaEnTx(transaction, id)) ?? notFound()
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (error) {
    toCategoriaConflict(error)
  }
}

function consultarCategoriaEnTx(transaction: CategoryTransaction, id: string) {
  return transaction.categoriaRepuesto.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      activo: true,
      fechaCreacion: true,
      fechaActualizacion: true,
      _count: { select: { repuestos: true } },
    },
  })
}
