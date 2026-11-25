import { prisma } from '../../config/database.js'

export type ResumenInventario = {
  totalRepuestos: number
  productosActivos: number
  productosStockBajo: number
  productosAgotados: number
  valorInventario?: string
}

type ConteosInventario = Omit<ResumenInventario, 'valorInventario'>

export async function consultarResumenInventario(
  incluirCostos: boolean,
): Promise<ResumenInventario> {
  const [conteos] = await prisma.$queryRaw<Array<ConteosInventario>>`
    SELECT
      COUNT(*)::integer AS "totalRepuestos",
      COUNT(*) FILTER (WHERE "activo")::integer AS "productosActivos",
      COUNT(*) FILTER (
        WHERE "activo" AND "stockActual" > 0 AND "stockActual" <= "stockMinimo"
      )::integer AS "productosStockBajo",
      COUNT(*) FILTER (WHERE "activo" AND "stockActual" = 0)::integer AS "productosAgotados"
    FROM "Repuesto"
  `

  if (!conteos) throw new Error('No se pudo consultar el resumen del inventario.')
  if (!incluirCostos) return conteos

  const [valor] = await prisma.$queryRaw<Array<{ value: string }>>`
    SELECT COALESCE(SUM("stockActual" * "precioCompra"), 0)::text AS value
    FROM "Repuesto"
    WHERE "activo" = true
  `

  return { ...conteos, valorInventario: valor?.value ?? '0' }
}
