import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminNavigation } from '../components/AdminNavigation'
import {
  ApiError,
  getAdminAppointments,
  getEmployeeIdentity,
  setAppointmentStatus,
  type AdminAppointment,
  type EmployeeIdentity,
} from '../services/api'
import { PageMetadata } from '../components/PageMetadata'

export function AdminPage() {
  const { session, loading: authLoading, signOut } = useAuth()
  const [employee, setEmployee] = useState<EmployeeIdentity | null>(null)
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    let active = true
    void getEmployeeIdentity(session.access_token)
      .then(async (identity) => {
        if (!active) return
        setError('')
        setEmployee(identity)
        if (identity.role === 'MECANICO')
          throw new ApiError('Tu cuenta no tiene permiso para el panel de recepción.', 403)
        setAppointments(await getAdminAppointments(session.access_token))
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(
          cause instanceof ApiError && cause.status === 403
            ? 'Esta cuenta no tiene un rol de empleado autorizado. Contacta al administrador.'
            : cause instanceof Error
              ? cause.message
              : 'No se pudieron cargar las citas.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  if (authLoading) return <main className="p-10 text-center">Verificando sesión…</main>
  if (!session) return <Navigate to="/login" replace state={{ from: { pathname: '/admin' } }} />

  async function updateStatus(appointment: AdminAppointment, status: 'CONFIRMADA' | 'CANCELADA') {
    if (!session) return
    setPendingId(appointment.id)
    setError('')
    try {
      const updated = await setAppointmentStatus(session.access_token, appointment.id, status)
      setAppointments((current) =>
        current.map((item) =>
          item.id === updated.id ? { ...item, status: updated.status } : item,
        ),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la cita.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 sm:px-8">
      <PageMetadata
        title="Panel administrativo"
        description="Panel privado para la gestión de citas de Claros Auto."
        indexable={false}
      />
      <div className="mx-auto max-w-6xl">
        <AdminNavigation
          title="Panel de citas"
          employee={employee}
          onSignOut={() => void signOut()}
        />
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
          >
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Cargando citas…</p>
        ) : !error && appointments.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600">
            Todavía no hay citas registradas.
          </p>
        ) : (
          <section aria-label="Solicitudes de cita" className="grid gap-4">
            {appointments.map((appointment) => (
              <article
                key={appointment.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{appointment.customer.name}</h2>
                    <p className="text-sm text-slate-600">
                      {appointment.service.name} · {appointment.vehicle.make}{' '}
                      {appointment.vehicle.model} ({appointment.vehicle.year})
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {appointment.customer.phone}
                      {appointment.customer.email ? ` · ${appointment.customer.email}` : ''}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      Preferida:{' '}
                      {new Intl.DateTimeFormat('es-HN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(appointment.requestedAt))}
                    </p>
                    {appointment.notes && (
                      <p className="mt-2 text-sm">Notas: {appointment.notes}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">
                    {appointment.status}
                  </span>
                </div>
                {appointment.status === 'PENDIENTE' && (
                  <div className="mt-4 flex gap-3">
                    <button
                      disabled={pendingId === appointment.id}
                      onClick={() => void updateStatus(appointment, 'CONFIRMADA')}
                      className="rounded-md bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      disabled={pendingId === appointment.id}
                      onClick={() => void updateStatus(appointment, 'CANCELADA')}
                      className="rounded-md border border-red-300 px-4 py-2 font-bold text-red-800 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
