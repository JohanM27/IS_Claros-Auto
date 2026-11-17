import { Router, type RequestHandler } from 'express'
import { crearControladorConsultaCita, crearControladorRegistroCita } from './cita.controller.js'
import { consultarSolicitudCita, registrarSolicitudCita } from './cita.service.js'
import type { CitaConsultable, CitaRegistrada } from './cita.types.js'
import type { CrearCitaInput } from './cita.schema.js'

type Registrar = (input: CrearCitaInput) => Promise<CitaRegistrada>
type Consultar = (id: string, token: string | undefined) => Promise<CitaConsultable>

export function crearRutasCitas(
  registrar: Registrar = registrarSolicitudCita,
  consultar: Consultar = consultarSolicitudCita,
  limitador: RequestHandler = (_request, _response, next) => next(),
) {
  const router = Router()
  router.post('/', limitador, crearControladorRegistroCita(registrar))
  router.get('/:id', crearControladorConsultaCita(consultar))
  return router
}
