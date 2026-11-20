import type { AppointmentFormValues } from '../types/appointment'
import type { Service } from '../types/service'

export const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api'

type ApiEnvelope<T> = { data: T }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('No fue posible conectar con el taller. Intenta de nuevo más tarde.', 0)
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } }
    | null

  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined
    throw new ApiError(
      error?.message ?? 'No se pudo completar la solicitud.',
      response.status,
      error?.details?.fieldErrors ?? {},
    )
  }

  if (!payload || !('data' in payload)) {
    throw new ApiError('El servidor devolvió una respuesta inesperada.', response.status)
  }
  return payload.data
}

export async function getServices(): Promise<Service[]> {
  return request<Service[]>('/servicios')
}

export type CreateAppointmentResponse = {
  id: string
  status: 'PENDIENTE'
  requestedAt: string
  createdAt: string
  service: { id: string; name: string }
  lookupToken: string
}

export async function createAppointment(
  values: AppointmentFormValues,
): Promise<CreateAppointmentResponse> {
  const requestedAt = new Date(`${values.preferredDate}T${values.preferredTime}:00`).toISOString()

  return request<CreateAppointmentResponse>('/citas', {
    method: 'POST',
    body: JSON.stringify({
      name: values.fullName,
      phone: values.phone,
      email: values.email,
      vehicleMake: values.vehicleMake,
      vehicleModel: values.vehicleModel,
      vehicleYear: values.vehicleYear,
      serviceId: values.service,
      requestedAt,
      notes: values.notes,
    }),
  })
}

export type EmployeeRole = 'ADMINISTRADOR' | 'RECEPCIONISTA' | 'MECANICO'
export type EmployeeIdentity = {
  id: string
  email: string | null
  role: EmployeeRole
  displayName: string | null
}
export type AdminAppointment = {
  id: string
  status: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA'
  requestedAt: string
  createdAt: string
  notes: string | null
  customer: { name: string; phone: string; email: string | null }
  vehicle: { make: string; model: string; year: number }
  service: { name: string }
}

export type WorkOrderStatus =
  'ABIERTA' | 'EN_DIAGNOSTICO' | 'EN_PROCESO' | 'FINALIZADA' | 'CANCELADA'

export type AdminWorkOrder = {
  id: string
  numeroOrden: string
  clienteId: string
  vehiculoId: string
  citaId: string | null
  descripcionProblema: string
  observaciones: string | null
  mecanicoResponsable: string | null
  estado: WorkOrderStatus
  fechaIngreso: string
  fechaCreacion: string
  fechaActualizacion: string
  cliente: { name: string; phone: string }
  vehiculo: { make: string; model: string; year: number; plate: string | null }
}

async function authenticatedRequest<T>(path: string, accessToken: string, init?: RequestInit) {
  return request<T>(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  })
}

export function getEmployeeIdentity(accessToken: string) {
  return authenticatedRequest<EmployeeIdentity>('/auth/me', accessToken)
}

export function getAdminAppointments(accessToken: string) {
  return authenticatedRequest<AdminAppointment[]>('/admin/citas', accessToken)
}

export function getAdminWorkOrders(accessToken: string) {
  return authenticatedRequest<AdminWorkOrder[]>('/admin/ordenes', accessToken)
}

export function setAppointmentStatus(
  accessToken: string,
  id: string,
  status: 'CONFIRMADA' | 'CANCELADA',
) {
  return authenticatedRequest<
    Pick<AdminAppointment, 'id' | 'status' | 'requestedAt' | 'createdAt'>
  >(`/admin/citas/${id}/estado`, accessToken, { method: 'PATCH', body: JSON.stringify({ status }) })
}
