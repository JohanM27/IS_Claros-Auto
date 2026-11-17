import { z } from 'zod'

const currentYear = new Date().getFullYear()

export const crearCitaSchema = z.object({
  name: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(7).max(30),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  vehicleMake: z.string().trim().min(1).max(80),
  vehicleModel: z.string().trim().min(1).max(100),
  vehicleYear: z.coerce
    .number()
    .int()
    .min(1886)
    .max(currentYear + 1),
  serviceId: z.string().trim().min(1).max(30),
  requestedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  notes: z.string().trim().max(1000).optional(),
})

export type CrearCitaInput = z.infer<typeof crearCitaSchema>

export function validarFechaCita(input: CrearCitaInput, now = new Date()) {
  if (input.requestedAt.getTime() <= now.getTime()) {
    return false
  }
  return true
}
