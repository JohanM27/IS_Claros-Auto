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

async function request<T>(path: string, init?: RequestInit, includeEnvelope = false): Promise<T> {
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
  return (includeEnvelope ? payload : payload.data) as T
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
  kilometraje: number | null
  estado: WorkOrderStatus
  fechaIngreso: string
  fechaCreacion: string
  fechaActualizacion: string
  cliente: { name: string; phone: string }
  vehiculo: { make: string; model: string; year: number; plate: string | null }
}

export type AdminWorkOrderListItem = {
  id: string
  numeroOrden: string
  descripcionProblema: string
  mecanicoResponsable: string | null
  estado: WorkOrderStatus
  fechaIngreso: string
  cliente: { name: string }
  vehiculo: { make: string; model: string; year: number; plate: string | null }
}
export type AdminWorkOrderFilters = {
  q?: string
  estado?: WorkOrderStatus
  fechaDesde?: string
  fechaHasta?: string
  mecanico?: string
  page?: number
  pageSize?: number
}
export type AdminWorkOrderPage = {
  data: AdminWorkOrderListItem[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
export type AdminWorkOrderDetails = Omit<AdminWorkOrder, 'cliente' | 'vehiculo'> & {
  cliente: { name: string; phone: string; email: string | null }
  vehiculo: { make: string; model: string; year: number; plate: string | null }
  cita: {
    id: string
    requestedAt: string
    status: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA'
    service: { name: string }
  } | null
}

export type WorkOrderCustomer = {
  id: string
  name: string
  phone: string
  email: string | null
  vehicles: { id: string; make: string; model: string; year: number; plate: string | null }[]
}
export type WorkOrderAppointment = {
  id: string
  requestedAt: string
  status: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA'
  service: { name: string }
}
export type CreateWorkOrderInput = {
  clienteId: string
  vehiculoId: string
  citaId: string | null
  descripcionProblema: string
  observaciones: string | null
  mecanicoResponsable: string | null
  kilometraje: number | null
  fechaIngreso: string
  idempotencyKey: string
}

async function authenticatedRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
  includeEnvelope = false,
) {
  return request<T>(
    path,
    {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
    },
    includeEnvelope,
  )
}

export function getEmployeeIdentity(accessToken: string) {
  return authenticatedRequest<EmployeeIdentity>('/auth/me', accessToken)
}

export function getAdminAppointments(accessToken: string) {
  return authenticatedRequest<AdminAppointment[]>('/admin/citas', accessToken)
}

export function getAdminWorkOrders(accessToken: string, filters: AdminWorkOrderFilters = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const search = query.size > 0 ? `?${query.toString()}` : ''
  return authenticatedRequest<AdminWorkOrderPage>(
    `/admin/ordenes${search}`,
    accessToken,
    undefined,
    true,
  )
}

export function getAdminWorkOrder(accessToken: string, id: string) {
  return authenticatedRequest<AdminWorkOrderDetails>(
    `/admin/ordenes/${encodeURIComponent(id)}`,
    accessToken,
  )
}

export function searchWorkOrderCustomers(accessToken: string, query: string) {
  return authenticatedRequest<WorkOrderCustomer[]>(
    `/admin/ordenes/clientes?q=${encodeURIComponent(query)}`,
    accessToken,
  )
}

export function getWorkOrderAppointments(
  accessToken: string,
  clienteId: string,
  vehiculoId: string,
) {
  const query = new URLSearchParams({ clienteId, vehiculoId })
  return authenticatedRequest<WorkOrderAppointment[]>(`/admin/ordenes/citas?${query}`, accessToken)
}

export function createWorkOrder(accessToken: string, input: CreateWorkOrderInput) {
  return authenticatedRequest<AdminWorkOrder>('/admin/ordenes', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
