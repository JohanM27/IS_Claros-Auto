import type { RequestHandler } from 'express'
import { z } from 'zod'
import { crearCitaSchema } from './cita.schema.js'
import type { CitaConsultable, CitaRegistrada } from './cita.types.js'

type Registrar = (input: z.infer<typeof crearCitaSchema>) => Promise<CitaRegistrada>
type Consultar = (id: string, token: string | undefined) => Promise<CitaConsultable>

export function crearControladorRegistroCita(registrar: Registrar): RequestHandler {
  return async (request, response) => {
    const input = crearCitaSchema.parse(request.body)
    const cita = await registrar(input)
    response.status(201).set('Cache-Control', 'no-store').json({ data: cita })
  }
}

export function crearControladorConsultaCita(consultar: Consultar): RequestHandler {
  return async (request, response) => {
    const token = request.get('authorization')?.replace(/^Bearer\s+/i, '')
    const id = request.params.id
    const appointmentId = z.uuid().parse(Array.isArray(id) ? id[0] : id)
    const cita = await consultar(appointmentId, token)
    response.status(200).set('Cache-Control', 'no-store').json({ data: cita })
  }
}
