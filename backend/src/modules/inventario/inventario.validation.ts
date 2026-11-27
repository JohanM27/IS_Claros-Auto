import { z } from 'zod'

export const unidadesMedidaRepuesto = [
  'UNIDAD',
  'LITRO',
  'GALON',
  'MILILITRO',
  'METRO',
  'KILOGRAMO',
  'GRAMO',
  'JUEGO',
  'PAR',
  'CAJA',
  'BOTELLA',
] as const

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable().optional(),
  )

export const nombreCategoriaSchema = z.string().trim().min(1).max(150)

export function normalizarNombreCategoria(nombre: string) {
  return nombre.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

const descripcionCategoriaSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().max(1000).nullable().optional(),
)

export const nuevaCategoriaSchema = z
  .object({
    nombre: nombreCategoriaSchema,
    descripcion: descripcionCategoriaSchema,
  })
  .strict()

export const actualizarCategoriaSchema = z
  .object({
    nombre: nombreCategoriaSchema.optional(),
    descripcion: descripcionCategoriaSchema,
  })
  .strict()
  .refine((value) => value.nombre !== undefined || value.descripcion !== undefined)

export const estadoCategoriaSchema = z.object({ activo: z.boolean() }).strict()

export const filtrosCategoriasSchema = z
  .object({
    q: z.string().trim().max(150).optional(),
    estado: z.enum(['TODAS', 'ACTIVAS', 'INACTIVAS']).default('TODAS'),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict()

export const filtrosRepuestosSchema = z
  .object({
    q: z.string().trim().max(180).optional(),
    categoriaId: z.uuid().optional(),
    marca: z.string().trim().max(100).optional(),
    estado: z.enum(['TODOS', 'ACTIVOS', 'INACTIVOS']).default('ACTIVOS'),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict()

const currencySchema = z
  .string()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Usa un importe no negativo con hasta dos decimales.')

const quantitySchema = z
  .string()
  .regex(/^\d{1,9}(?:\.\d{1,3})?$/, 'Usa una cantidad no negativa con hasta tres decimales.')

export const nuevoRepuestoSchema = z
  .object({
    claveIdempotencia: z.uuid(),
    codigoBarras: optionalText(80),
    nombre: z.string().trim().min(1).max(180),
    descripcion: optionalText(2000),
    categoriaId: z.uuid(),
    marca: optionalText(100),
    numeroParte: optionalText(100),
    unidadMedida: z.enum(unidadesMedidaRepuesto).default('UNIDAD'),
    precioCompra: currencySchema,
    precioVenta: currencySchema,
    stockMinimo: quantitySchema.default('0'),
  })
  .strict()

export type NuevoRepuestoInput = z.infer<typeof nuevoRepuestoSchema>

export const actualizarRepuestoSchema = z
  .object({
    codigoBarras: optionalText(80),
    nombre: z.string().trim().min(1).max(180).optional(),
    descripcion: optionalText(2000),
    categoriaId: z.uuid().optional(),
    marca: optionalText(100),
    numeroParte: optionalText(100),
    unidadMedida: z.enum(unidadesMedidaRepuesto).optional(),
    precioCompra: currencySchema.optional(),
    precioVenta: currencySchema.optional(),
    stockMinimo: quantitySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)

export const estadoRepuestoSchema = z.object({ activo: z.boolean() }).strict()
