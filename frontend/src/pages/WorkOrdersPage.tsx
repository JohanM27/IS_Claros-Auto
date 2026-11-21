import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminNavigation } from '../components/AdminNavigation'
import { PageMetadata } from '../components/PageMetadata'
import {
  ApiError,
  getAdminWorkOrders,
  getEmployeeIdentity,
  searchWorkOrderCustomers,
  getWorkOrderAppointments,
  createWorkOrder,
  type AdminWorkOrder,
  type EmployeeIdentity,
  type WorkOrderCustomer,
  type WorkOrderAppointment,
} from '../services/api'

export function WorkOrdersPage() {
  const { session, loading: authLoading, signOut } = useAuth()
  const [employee, setEmployee] = useState<EmployeeIdentity | null>(null)
  const [workOrders, setWorkOrders] = useState<AdminWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const location = useLocation()
  const isCreatePage = location.pathname.endsWith('/nueva')

  useEffect(() => {
    if (!session) return
    let active = true
    void getEmployeeIdentity(session.access_token)
      .then(async (identity) => {
        if (!active) return
        if (identity.role !== 'ADMINISTRADOR' && identity.role !== 'RECEPCIONISTA') {
          throw new ApiError('Esta cuenta no tiene acceso al sistema administrativo.', 403)
        }
        setEmployee(identity)
        if (!isCreatePage) setWorkOrders(await getAdminWorkOrders(session.access_token))
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(
          cause instanceof ApiError && cause.status === 403
            ? 'Esta cuenta no tiene un rol autorizado para gestionar órdenes de trabajo.'
            : cause instanceof Error
              ? cause.message
              : 'No se pudieron cargar las órdenes de trabajo.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session, isCreatePage])

  if (authLoading) return <main className="p-10 text-center">Verificando sesión…</main>
  if (!session) {
    return <Navigate to="/login" replace state={{ from: { pathname: '/admin/ordenes' } }} />
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 sm:px-8">
      <PageMetadata
        title="Órdenes de trabajo"
        description="Panel privado de órdenes de trabajo de Claros Auto."
        indexable={false}
      />
      <div className="mx-auto max-w-6xl">
        <AdminNavigation
          title="Órdenes de trabajo"
          employee={employee}
          onSignOut={() => void signOut()}
        />
        <p className="mb-6 max-w-2xl text-slate-600">
          Consulta las órdenes registradas y los trabajos asignados a cada mecánico.
        </p>
        {isCreatePage && session ? (
          loading ? (
            <p role="status">Verificando permisos…</p>
          ) : error ? (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
              {error}
            </p>
          ) : employee ? (
            <CreateWorkOrderForm accessToken={session.access_token} />
          ) : null
        ) : (
          <>
            <div className="mb-5 flex justify-end">
              <Link
                to="/admin/ordenes/nueva"
                className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
              >
                Nueva orden de trabajo
              </Link>
            </div>
            {error && (
              <p
                role="alert"
                className="mb-5 rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
              >
                {error}
              </p>
            )}
            {loading ? (
              <p role="status">Cargando órdenes de trabajo…</p>
            ) : !error && workOrders.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600">
                Todavía no hay órdenes de trabajo registradas.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-[900px] divide-y divide-slate-200 text-left text-sm">
                  <caption className="sr-only">Órdenes de trabajo registradas</caption>
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3" scope="col">
                        Orden
                      </th>
                      <th className="px-4 py-3" scope="col">
                        Cliente
                      </th>
                      <th className="px-4 py-3" scope="col">
                        Vehículo
                      </th>
                      <th className="px-4 py-3" scope="col">
                        Problema
                      </th>
                      <th className="px-4 py-3" scope="col">
                        Mecánico responsable
                      </th>
                      <th className="px-4 py-3" scope="col">
                        Estado
                      </th>
                      <th className="px-4 py-3" scope="col">
                        Ingreso
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="whitespace-nowrap px-4 py-4 font-bold">
                          {order.numeroOrden}
                        </td>
                        <td className="px-4 py-4">{order.cliente.name}</td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {order.vehiculo.make} {order.vehiculo.model} ({order.vehiculo.year})
                        </td>
                        <td className="max-w-xs px-4 py-4">{order.descripcionProblema}</td>
                        <td className="px-4 py-4">{order.mecanicoResponsable ?? 'Sin asignar'}</td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {order.estado.replaceAll('_', ' ')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium' }).format(
                            new Date(order.fechaIngreso),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function CreateWorkOrderForm({ accessToken }: { accessToken: string }) {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<WorkOrderCustomer[]>([])
  const [customer, setCustomer] = useState<WorkOrderCustomer | null>(null)
  const [vehicleId, setVehicleId] = useState('')
  const [appointments, setAppointments] = useState<WorkOrderAppointment[]>([])
  const [appointmentId, setAppointmentId] = useState('')
  const [date, setDate] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 10)
  })
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [mechanic, setMechanic] = useState('')
  const [mileage, setMileage] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<AdminWorkOrder | null>(null)

  useEffect(() => {
    if (!customer || !vehicleId) return
    let active = true
    void getWorkOrderAppointments(accessToken, customer.id, vehicleId)
      .then((items) => {
        if (active) setAppointments(items)
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las citas.')
      })
    return () => {
      active = false
    }
  }, [accessToken, customer, vehicleId])

  function changed() {
    setIdempotencyKey(crypto.randomUUID())
    setSuccess(null)
    setError('')
  }

  async function search() {
    if (query.trim().length < 2) {
      setError('Escribe al menos dos caracteres para buscar un cliente.')
      return
    }
    setSearching(true)
    setError('')
    setHasSearched(true)
    try {
      setCustomers(await searchWorkOrderCustomers(accessToken, query.trim()))
      setCustomer(null)
      setVehicleId('')
      setAppointments([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo buscar al cliente.')
    } finally {
      setSearching(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!customer || !vehicleId) {
      setError('Selecciona un cliente y uno de sus vehículos.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const order = await createWorkOrder(accessToken, {
        clienteId: customer.id,
        vehiculoId: vehicleId,
        citaId: appointmentId || null,
        descripcionProblema: description.trim(),
        observaciones: notes.trim() || null,
        mecanicoResponsable: mechanic.trim() || null,
        kilometraje: mileage ? Number(mileage) : null,
        fechaIngreso: new Date(`${date}T12:00:00`).toISOString(),
        idempotencyKey,
      })
      setSuccess(order)
      setIdempotencyKey(crypto.randomUUID())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar la orden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Nueva orden de trabajo</h2>
        <Link className="font-semibold text-blue-700 underline" to="/admin/ordenes">
          Volver a órdenes
        </Link>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}
      {success && (
        <div
          role="status"
          className="mb-5 rounded-md border border-green-300 bg-green-50 p-4 text-green-900"
        >
          Orden <strong>{success.numeroOrden}</strong> registrada correctamente. Estado: ABIERTA.{' '}
          <Link to="/admin/ordenes" className="font-semibold underline">
            Consultar órdenes
          </Link>
        </div>
      )}
      <form onSubmit={submit} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="mb-2 font-bold">Cliente y vehículo</legend>
          <label className="block text-sm font-semibold" htmlFor="customer-search">
            Buscar cliente por nombre, teléfono o correo
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="customer-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                changed()
              }}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
              placeholder="Nombre, teléfono o correo"
            />
            <button
              type="button"
              onClick={() => void search()}
              disabled={searching}
              className="rounded-md border border-slate-300 px-4 py-2 font-semibold disabled:opacity-60"
            >
              {searching ? 'Buscando…' : 'Buscar cliente'}
            </button>
          </div>
          {customers.length > 0 && !customer && (
            <ul className="max-h-52 overflow-y-auto rounded-md border border-slate-200">
              {customers.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomer(item)
                      setVehicleId('')
                      setAppointments([])
                      setError('')
                      changed()
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    {item.name} · {item.phone}
                    {item.email ? ` · ${item.email}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hasSearched && customers.length === 0 && !searching && !customer && (
            <p className="text-sm text-slate-600">
              No se encontraron clientes. Primero registra al cliente y vehículo desde el flujo
              correspondiente.
            </p>
          )}
          {customer && (
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <strong>{customer.name}</strong>
              <br />
              Tel. {customer.phone}
              {customer.email ? ` · ${customer.email}` : ''}
              <button
                type="button"
                className="ml-3 font-semibold text-blue-700 underline"
                onClick={() => {
                  setCustomer(null)
                  setVehicleId('')
                  setAppointments([])
                  changed()
                }}
              >
                Cambiar
              </button>
            </div>
          )}
          <label className="block text-sm font-semibold" htmlFor="work-order-vehicle">
            Vehículo
          </label>
          <select
            id="work-order-vehicle"
            required
            disabled={!customer}
            value={vehicleId}
            onChange={(event) => {
              setVehicleId(event.target.value)
              setAppointmentId('')
              setAppointments([])
              changed()
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          >
            <option value="">Selecciona un vehículo</option>
            {customer?.vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate ? `${vehicle.plate} · ` : ''}
                {vehicle.make} {vehicle.model} ({vehicle.year})
              </option>
            ))}
          </select>
          {customer && customer.vehicles.length === 0 && (
            <p className="text-sm text-amber-800">
              Este cliente todavía no tiene vehículos registrados.
            </p>
          )}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-bold">Datos de ingreso</legend>
          <p className="sm:col-span-2 text-sm text-slate-600">
            El número de orden se asignará automáticamente al guardar. Estado inicial: ABIERTA.
          </p>
          <label className="text-sm font-semibold">
            Fecha de ingreso
            <input
              type="date"
              required
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                changed()
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Kilometraje (opcional)
            <input
              type="number"
              min="0"
              max="2000000"
              value={mileage}
              onChange={(event) => {
                setMileage(event.target.value)
                changed()
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Problema reportado
            <textarea
              required
              minLength={1}
              maxLength={2000}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
                changed()
              }}
              rows={4}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Mecánico responsable (opcional)
            <input
              maxLength={150}
              value={mechanic}
              onChange={(event) => {
                setMechanic(event.target.value)
                changed()
              }}
              placeholder="Nombre del trabajador"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Cita relacionada (opcional)
            <select
              disabled={!vehicleId}
              value={appointmentId}
              onChange={(event) => {
                setAppointmentId(event.target.value)
                changed()
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            >
              <option value="">Sin cita previa</option>
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {new Intl.DateTimeFormat('es-HN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(appointment.requestedAt))}{' '}
                  · {appointment.service.name} · {appointment.status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Observaciones
            <textarea
              maxLength={2000}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value)
                changed()
              }}
              rows={3}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </fieldset>
        <button
          type="submit"
          disabled={saving || success !== null}
          className="w-full rounded-md bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando orden…' : 'Registrar orden de trabajo'}
        </button>
      </form>
    </section>
  )
}
