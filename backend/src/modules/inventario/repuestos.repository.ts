import { Prisma } from '../../generated/prisma/client.js'
import type { z } from 'zod'
import { prisma } from '../../config/database.js'
import { HttpError } from '../../utils/httpError.js'
import { validarCategoriaActivaParaRepuesto } from './categorias.repository.js'
import { generarSkuRepuesto } from './repuesto.sku.js'
import type { actualizarRepuestoSchema, nuevoRepuestoSchema } from './inventario.validation.js'

export type FiltrosRepuestos = {
  q?: string
  categoriaId?: string
  marca?: string
  estado: 'TODOS' | 'ACTIVOS' | 'INACTIVOS'
  page: number
  pageSize: number
}
export type NuevoRepuestoInput = z.infer<typeof nuevoRepuestoSchema>
export type RepuestoPatchInput = z.infer<typeof actualizarRepuestoSchema>

function selectRepuesto(incluirCostos: boolean): Prisma.RepuestoSelect {
  return {
    id: true,
    sku: true,
    codigoBarras: true,
    nombre: true,
    descripcion: true,
    categoriaId: true,
    marca: true,
    numeroParte: true,
    unidadMedida: true,
    ...(incluirCostos ? { precioCompra: true } : {}),
    precioVenta: true,
    stockActual: true,
    stockMinimo: true,
    activo: true,
    fechaCreacion: true,
    fechaActualizacion: true,
    categoria: { select: { id: true, nombre: true, activo: true } },
  }
}

function presentarRepuesto<T extends object>(item: T) {
  const result = { ...item } as Record<string, unknown>
  for (const key of ['precioCompra', 'precioVenta', 'stockActual', 'stockMinimo']) {
    const value = result[key]
    if (value instanceof Prisma.Decimal) result[key] = value.toString()
  }
  return result
}

function traducirConflicto(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : ''
      if (target.includes('codigoBarras')) {
        throw new HttpError(409, 'BARCODE_EXISTS', 'Ese código de barras ya está registrado.')
      }
      if (target.includes('sku')) {
        throw new HttpError(409, 'SKU_CONFLICT', 'No se pudo reservar el SKU. Intenta de nuevo.')
      }
      throw new HttpError(
        409,
        'PRODUCT_CONFLICT',
        'El repuesto coincide con un registro existente.',
      )
    }
    if (error.code === 'P2034') {
      throw new HttpError(
        409,
        'PRODUCT_CHANGED',
        'El repuesto cambió durante la operación. Actualiza la página e inténtalo de nuevo.',
      )
    }
    if (error.code === 'P2025') notFound()
  }
  throw error
}

function notFound(): never {
  throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'No se encontró el repuesto.')
}

function filtrosWhere(filters: FiltrosRepuestos, soloActivos: boolean): Prisma.RepuestoWhereInput {
  const where: Prisma.RepuestoWhereInput = {}
  const activo = soloActivos
    ? true
    : filters.estado === 'ACTIVOS'
      ? true
      : filters.estado === 'INACTIVOS'
        ? false
        : undefined
  if (activo !== undefined) where.activo = activo
  if (filters.categoriaId) where.categoriaId = filters.categoriaId
  if (filters.marca) where.marca = { equals: filters.marca, mode: 'insensitive' }
  if (filters.q) {
    where.OR = [
      { nombre: { contains: filters.q, mode: 'insensitive' } },
      { sku: { equals: filters.q, mode: 'insensitive' } },
      { codigoBarras: { contains: filters.q } },
      { numeroParte: { contains: filters.q, mode: 'insensitive' } },
      { marca: { contains: filters.q, mode: 'insensitive' } },
    ]
  }
  return where
}

export async function listarRepuestos(
  filters: FiltrosRepuestos,
  incluirCostos: boolean,
  soloActivos = false,
) {
  const where = filtrosWhere(filters, soloActivos)
  const skip = (filters.page - 1) * filters.pageSize
  const [total, data, exactBarcode] = await Promise.all([
    prisma.repuesto.count({ where }),
    prisma.repuesto.findMany({
      where,
      skip,
      take: filters.pageSize,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      select: selectRepuesto(incluirCostos),
    }),
    filters.q
      ? prisma.repuesto.findFirst({
          where: { ...where, codigoBarras: filters.q },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])
  let ordered = data
  if (exactBarcode && filters.page === 1) {
    const exactIndex = data.findIndex((item) => item.id === exactBarcode.id)
    if (exactIndex > 0) {
      ordered = [data[exactIndex], ...data.slice(0, exactIndex), ...data.slice(exactIndex + 1)]
    }
  }
  return {
    data: ordered.map(presentarRepuesto),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  }
}

export async function consultarRepuesto(id: string, incluirCostos: boolean, soloActivos = false) {
  const item = await prisma.repuesto.findFirst({
    where: { id, ...(soloActivos ? { activo: true } : {}) },
    select: selectRepuesto(incluirCostos),
  })
  return item ? presentarRepuesto(item) : null
}

export async function crearRepuesto(input: NuevoRepuestoInput) {
  const existing = await prisma.repuesto.findUnique({
    where: { claveIdempotencia: input.claveIdempotencia },
    select: selectRepuesto(true),
  })
  if (existing) return presentarRepuesto(existing)
  const sku = await generarSkuRepuesto()
  try {
    return await prisma.$transaction(async (transaction) => {
      await validarCategoriaActivaParaRepuesto(transaction, input.categoriaId)
      const product = await transaction.repuesto.create({
        data: {
          claveIdempotencia: input.claveIdempotencia,
          sku,
          codigoBarras: input.codigoBarras ?? null,
          nombre: input.nombre.trim(),
          descripcion: input.descripcion ?? null,
          categoriaId: input.categoriaId,
          marca: input.marca ?? null,
          numeroParte: input.numeroParte ?? null,
          unidadMedida: input.unidadMedida,
          precioCompra: new Prisma.Decimal(input.precioCompra),
          precioVenta: new Prisma.Decimal(input.precioVenta),
          stockMinimo: new Prisma.Decimal(input.stockMinimo),
          stockActual: new Prisma.Decimal(0),
        },
        select: selectRepuesto(true),
      })
      return presentarRepuesto(product)
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes('claveIdempotencia')
    ) {
      const createdByRetry = await prisma.repuesto.findUnique({
        where: { claveIdempotencia: input.claveIdempotencia },
        select: selectRepuesto(true),
      })
      if (createdByRetry) return presentarRepuesto(createdByRetry)
    }
    traducirConflicto(error)
  }
}

export async function actualizarRepuesto(
  id: string,
  input: RepuestoPatchInput,
  incluirCostos: boolean,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Repuesto" WHERE "id" = ${id} FOR UPDATE
      `
      if (locked.length === 0) notFound()
      const current = await transaction.repuesto.findUnique({
        where: { id },
        select: { stockActual: true, unidadMedida: true },
      })
      if (!current) notFound()
      if (
        input.unidadMedida &&
        input.unidadMedida !== current.unidadMedida &&
        !current.stockActual.isZero()
      ) {
        throw new HttpError(
          409,
          'UNIT_HAS_STOCK',
          'No se puede cambiar la unidad mientras el repuesto tenga existencias.',
        )
      }
      if (input.categoriaId)
        await validarCategoriaActivaParaRepuesto(transaction, input.categoriaId)
      const product = await transaction.repuesto.update({
        where: { id },
        data: {
          ...(input.codigoBarras === undefined ? {} : { codigoBarras: input.codigoBarras }),
          ...(input.nombre === undefined ? {} : { nombre: input.nombre.trim() }),
          ...(input.descripcion === undefined ? {} : { descripcion: input.descripcion }),
          ...(input.categoriaId === undefined ? {} : { categoriaId: input.categoriaId }),
          ...(input.marca === undefined ? {} : { marca: input.marca }),
          ...(input.numeroParte === undefined ? {} : { numeroParte: input.numeroParte }),
          ...(input.unidadMedida === undefined ? {} : { unidadMedida: input.unidadMedida }),
          ...(input.precioCompra === undefined
            ? {}
            : { precioCompra: new Prisma.Decimal(input.precioCompra) }),
          ...(input.precioVenta === undefined
            ? {}
            : { precioVenta: new Prisma.Decimal(input.precioVenta) }),
          ...(input.stockMinimo === undefined
            ? {}
            : { stockMinimo: new Prisma.Decimal(input.stockMinimo) }),
        },
        select: selectRepuesto(incluirCostos),
      })
      return presentarRepuesto(product)
    })
  } catch (error) {
    traducirConflicto(error)
  }
}

export async function cambiarEstadoRepuesto(id: string, activo: boolean) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Repuesto" WHERE "id" = ${id} FOR UPDATE
      `
      if (locked.length === 0) notFound()
      const current = await transaction.repuesto.findUnique({
        where: { id },
        select: { activo: true, stockActual: true, categoriaId: true },
      })
      if (!current) notFound()
      if (current.activo === activo) {
        const unchanged = await transaction.repuesto.findUnique({
          where: { id },
          select: selectRepuesto(true),
        })
        return unchanged ? presentarRepuesto(unchanged) : notFound()
      }
      if (!activo && current.stockActual.greaterThan(0)) {
        throw new HttpError(
          409,
          'PRODUCT_HAS_STOCK',
          'No se puede desactivar un repuesto con existencias.',
        )
      }
      if (activo) await validarCategoriaActivaParaRepuesto(transaction, current.categoriaId)
      return presentarRepuesto(
        await transaction.repuesto.update({
          where: { id },
          data: { activo },
          select: selectRepuesto(true),
        }),
      )
    })
  } catch (error) {
    traducirConflicto(error)
  }
}
