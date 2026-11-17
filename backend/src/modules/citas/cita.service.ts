import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpError } from '../../utils/httpError.js'
import { buscarCitaPorId, crearRegistroCita, obtenerHashTokenCita } from './cita.repository.js'
import type { CrearCitaInput } from './cita.schema.js'
import { validarFechaCita } from './cita.schema.js'

type Crear = (
  input: CrearCitaInput,
  tokenHash: string,
) => Promise<{
  id: string
  status: string
  requestedAt: Date
  createdAt: Date
  service: { id: string; name: string }
} | null>

type Consultar = (id: string) => Promise<{
  id: string
  status: string
  requestedAt: Date
  createdAt: Date
  service: { name: string }
} | null>
type BuscarHash = (id: string) => Promise<string | null>

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function registrarSolicitudCita(
  input: CrearCitaInput,
  crear: Crear = crearRegistroCita,
) {
  if (!validarFechaCita(input)) {
    throw new HttpError(400, 'INVALID_DATE', 'La fecha solicitada debe estar en el futuro.', {
      fieldErrors: { requestedAt: ['Selecciona una fecha y hora futuras.'] },
    })
  }

  const token = randomBytes(32).toString('hex')
  const appointment = await crear(input, hashToken(token))
  if (!appointment) {
    throw new HttpError(400, 'INVALID_SERVICE', 'El servicio seleccionado no está disponible.', {
      fieldErrors: { serviceId: ['Selecciona un servicio disponible.'] },
    })
  }

  return {
    id: appointment.id,
    status: 'PENDIENTE' as const,
    requestedAt: appointment.requestedAt.toISOString(),
    createdAt: appointment.createdAt.toISOString(),
    service: appointment.service,
    lookupToken: token,
  }
}

export async function consultarSolicitudCita(
  id: string,
  token: string | undefined,
  consultar: Consultar = buscarCitaPorId,
  buscarHash: BuscarHash = obtenerHashTokenCita,
) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new HttpError(401, 'INVALID_LOOKUP_TOKEN', 'Se requiere un token de consulta válido.')
  }
  const expectedHash = await buscarHash(id)
  const actualHash = hashToken(token)
  const matches =
    expectedHash !== null &&
    timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(actualHash, 'hex'))
  if (!matches) {
    throw new HttpError(404, 'APPOINTMENT_NOT_FOUND', 'No se encontró la solicitud de cita.')
  }
  const appointment = await consultar(id)
  if (!appointment) {
    throw new HttpError(404, 'APPOINTMENT_NOT_FOUND', 'No se encontró la solicitud de cita.')
  }
  return {
    ...appointment,
    requestedAt: appointment.requestedAt.toISOString(),
    createdAt: appointment.createdAt.toISOString(),
  }
}
