import { describe, expect, it } from 'vitest'
import {
  actualizarCategoriaSchema,
  actualizarRepuestoSchema,
  filtrosCategoriasSchema,
  filtrosRepuestosSchema,
  normalizarNombreCategoria,
  nuevaCategoriaSchema,
  nuevoRepuestoSchema,
} from './inventario.validation.js'

const validPart = {
  claveIdempotencia: '1218d43a-1e71-4f80-aef0-227d53d52968',
  nombre: 'Filtro de aceite',
  categoriaId: 'c4d15662-b21d-4789-83a1-6422e7923bd5',
  precioCompra: '125.50',
  precioVenta: '180',
}

describe('validaciones iniciales de inventario', () => {
  it('requiere nombres y normaliza categorías equivalentes', () => {
    expect(normalizarNombreCategoria('  Filtros   de ACEITE ')).toBe('filtros de aceite')
    expect(nuevoRepuestoSchema.safeParse({ ...validPart, nombre: '  ' }).success).toBe(false)
  })

  it('acepta códigos de barras como texto y conserva ceros iniciales', () => {
    const parsed = nuevoRepuestoSchema.parse({ ...validPart, codigoBarras: '0012345678905' })
    expect(parsed.codigoBarras).toBe('0012345678905')
  })

  it('rechaza importes o stock mínimo negativos e inválidos', () => {
    expect(nuevoRepuestoSchema.safeParse({ ...validPart, precioCompra: '-1' }).success).toBe(false)
    expect(nuevoRepuestoSchema.safeParse({ ...validPart, stockMinimo: '-0.1' }).success).toBe(false)
  })

  it('asigna unidad y stock mínimo predeterminados, sin aceptar stock actual del cliente', () => {
    const parsed = nuevoRepuestoSchema.parse(validPart)
    expect(parsed.unidadMedida).toBe('UNIDAD')
    expect(parsed.stockMinimo).toBe('0')
    expect(nuevoRepuestoSchema.safeParse({ ...validPart, stockActual: '8' }).success).toBe(false)
  })

  it('no acepta SKU ni stock actual y el parche no asigna valores predeterminados', () => {
    expect(nuevoRepuestoSchema.safeParse({ ...validPart, sku: 'REP-00001' }).success).toBe(false)
    expect(actualizarRepuestoSchema.safeParse({ stockActual: '5' }).success).toBe(false)
    expect(actualizarRepuestoSchema.safeParse({ sku: 'REP-00002' }).success).toBe(false)
    expect(actualizarRepuestoSchema.safeParse({}).success).toBe(false)
    expect(actualizarRepuestoSchema.parse({ precioVenta: '190.00' }).unidadMedida).toBeUndefined()
  })

  it('valida filtros de productos, UUIDs, estados y límite de paginación', () => {
    expect(filtrosRepuestosSchema.parse({}).pageSize).toBe(10)
    expect(filtrosRepuestosSchema.safeParse({ estado: 'ELIMINADOS' }).success).toBe(false)
    expect(filtrosRepuestosSchema.safeParse({ categoriaId: 'sin-uuid' }).success).toBe(false)
    expect(filtrosRepuestosSchema.safeParse({ pageSize: '51' }).success).toBe(false)
  })

  it('limpia el nombre y hace equivalentes mayúsculas, Unicode y espacios repetidos', () => {
    const first = nuevaCategoriaSchema.parse({ nombre: '  Filtros   de ACEITE ' })
    const second = nuevaCategoriaSchema.parse({ nombre: 'filtros de aceite' })

    expect(first.nombre).toBe('Filtros   de ACEITE')
    expect(normalizarNombreCategoria(first.nombre)).toBe(normalizarNombreCategoria(second.nombre))
  })

  it('rechaza nombres vacíos, campos extra y descripciones demasiado largas', () => {
    expect(nuevaCategoriaSchema.safeParse({ nombre: '   ' }).success).toBe(false)
    expect(nuevaCategoriaSchema.safeParse({ nombre: 'Frenos', activo: false }).success).toBe(false)
    expect(
      nuevaCategoriaSchema.safeParse({ nombre: 'Frenos', descripcion: 'x'.repeat(1001) }).success,
    ).toBe(false)
  })

  it('permite editar nombre o descripción y rechaza un cambio vacío', () => {
    expect(actualizarCategoriaSchema.safeParse({ nombre: 'Frenos' }).success).toBe(true)
    expect(actualizarCategoriaSchema.safeParse({ descripcion: null }).success).toBe(true)
    expect(actualizarCategoriaSchema.safeParse({}).success).toBe(false)
  })

  it('valida filtros y usa diez elementos por página de forma predeterminada', () => {
    expect(filtrosCategoriasSchema.parse({}).pageSize).toBe(10)
    expect(filtrosCategoriasSchema.safeParse({ estado: 'ELIMINADAS' }).success).toBe(false)
    expect(filtrosCategoriasSchema.safeParse({ page: '0' }).success).toBe(false)
  })
})
