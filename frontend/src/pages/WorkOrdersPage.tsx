import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminNavigation } from '../components/AdminNavigation'
import { PageMetadata } from '../components/PageMetadata'
import {
  getAdminWorkOrder,
  getAdminWorkOrders,
  getWorkOrderStatusHistory,
  searchWorkOrderCustomers,
  getWorkOrderAppointments,
  createWorkOrder,
  updateWorkOrderStatus,
  getWorkOrderDiagnosis,
  saveWorkOrderDiagnosis,
  getWorkOrderTasks,
  createWorkOrderTask,
  updateWorkOrderTask,
  removeWorkOrderTask,
  getWorkOrderRecordAudit,
  type AdminWorkOrder,
  type AdminWorkOrderDetails,
  type AdminWorkOrderListItem,
  type WorkOrderStatus,
  type WorkOrderStatusHistoryEntry,
  type WorkOrderCustomer,
  type WorkOrderAppointment,
  type WorkOrderDiagnosis,
  type WorkTask,
  type WorkOrderRecordAudit,
  type WorkTaskInput,
} from '../services/api'

type WorkOrderListCacheEntry = {
  data: AdminWorkOrderListItem[]
  pagination: { total: number; totalPages: number }
}

type WorkOrderListFilters = {
  q: string
  estado: WorkOrderStatus | ''
  fechaDesde: string
  fechaHasta: string
  mecanico: string
  page: number
}

const workOrderListCache = new Map<string, WorkOrderListCacheEntry>()

function workOrderListCacheKey(userId: string, filters: WorkOrderListFilters) {
  return `${userId}:${JSON.stringify(filters)}`
}

function saveWorkOrderListToCache(key: string, result: WorkOrderListCacheEntry) {
  workOrderListCache.delete(key)
  workOrderListCache.set(key, result)
  if (workOrderListCache.size > 30) {
    const oldestKey = workOrderListCache.keys().next().value
    if (oldestKey) workOrderListCache.delete(oldestKey)
  }
}

function clearWorkOrderCacheForUser(userId: string) {
  for (const key of workOrderListCache.keys()) {
    if (key.startsWith(`${userId}:`)) workOrderListCache.delete(key)
  }
}

export function WorkOrdersPage() {
  const {
    session,
    employee,
    employeeLoading,
    loading: authLoading,
    signOut,
  } = useAuth()
  const location = useLocation()
  const { id: orderId } = useParams()
  const isCreatePage = location.pathname.endsWith('/nueva')
  const title = isCreatePage
    ? 'Nueva orden de trabajo'
    : orderId
      ? 'Detalle de orden de trabajo'
      : 'Órdenes de trabajo'

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
          title={title}
          employee={employee}
          onSignOut={() => {
            if (employee) clearWorkOrderCacheForUser(employee.id)
            void signOut()
          }}
        />
        {employeeLoading ? (
          <p role="status">Verificando permisos…</p>
        ) : !employee || employee.role === 'MECANICO' ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
            Esta cuenta no tiene un rol autorizado para gestionar órdenes de trabajo.
          </p>
        ) : employee && session ? (
          isCreatePage ? (
            <CreateWorkOrderForm accessToken={session.access_token} />
          ) : orderId ? (
            <WorkOrderDetail accessToken={session.access_token} id={orderId} />
          ) : (
            <WorkOrdersList accessToken={session.access_token} userId={employee.id} />
          )
        ) : null}
      </div>
    </main>
  )
}

function WorkOrdersList({ accessToken, userId }: { accessToken: string; userId: string }) {
  const defaultCacheKey = workOrderListCacheKey(userId, {
    q: '',
    estado: '',
    fechaDesde: '',
    fechaHasta: '',
    mecanico: '',
    page: 1,
  })
  const initialCachedList = workOrderListCache.get(defaultCacheKey)
  const [orders, setOrders] = useState<AdminWorkOrderListItem[]>(() => initialCachedList?.data ?? [])
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [status, setStatus] = useState<WorkOrderStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [mechanic, setMechanic] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(() => initialCachedList?.pagination.total ?? 0)
  const [totalPages, setTotalPages] = useState(
    () => initialCachedList?.pagination.totalPages ?? 1,
  )
  const [loading, setLoading] = useState(!initialCachedList)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    let active = true
    const filters: WorkOrderListFilters = {
      q: debouncedQuery,
      estado: status,
      fechaDesde: dateFrom,
      fechaHasta: dateTo,
      mecanico: mechanic.trim(),
      page,
    }
    const cacheKey = workOrderListCacheKey(userId, filters)
    const cachedList = workOrderListCache.get(cacheKey)
    if (cachedList) {
      setOrders(cachedList.data)
      setTotal(cachedList.pagination.total)
      setTotalPages(cachedList.pagination.totalPages)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError('')
    void getAdminWorkOrders(accessToken, {
      q: debouncedQuery || undefined,
      estado: status || undefined,
      fechaDesde: dateFrom || undefined,
      fechaHasta: dateTo || undefined,
      mecanico: mechanic.trim() || undefined,
      page,
      pageSize: 10,
    })
      .then((result) => {
        if (!active) return
        saveWorkOrderListToCache(cacheKey, result)
        setOrders(result.data)
        setTotal(result.pagination.total)
        setTotalPages(result.pagination.totalPages)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las órdenes.')
        if (!cachedList) {
          setOrders([])
          setTotal(0)
          setTotalPages(1)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accessToken, userId, debouncedQuery, status, dateFrom, dateTo, mechanic, page, refreshKey])

  function resetPage() {
    setPage(1)
    setLoading(true)
    setError('')
  }

  function clearFilters() {
    setQuery('')
    setDebouncedQuery('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
    setMechanic('')
    setPage(1)
    setLoading(true)
    setError('')
  }

  const hasFilters = Boolean(query || status || dateFrom || dateTo || mechanic)
  const firstResult = total === 0 ? 0 : (page - 1) * 10 + 1
  const lastResult = Math.min(page * 10, total)

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-slate-600">
          Consulta, busca y filtra las órdenes registradas en el taller.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setError('')
              setRefreshKey((value) => value + 1)
            }}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold disabled:opacity-60"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
          <Link
            to="/admin/ordenes/nueva"
            className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            Nueva orden
          </Link>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
          Buscar por número de orden, cliente o placa
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              resetPage()
            }}
            placeholder="Ej. OT-000001, Johan o HAA-1234"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Estado
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as WorkOrderStatus | '')
              resetPage()
            }}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
          >
            <option value="">Todos los estados</option>
            <option value="ABIERTA">Abierta</option>
            <option value="EN_DIAGNOSTICO">En diagnóstico</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Desde
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value)
              resetPage()
            }}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Hasta
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value)
              resetPage()
            }}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Mecánico responsable
          <input
            type="search"
            value={mechanic}
            onChange={(event) => {
              setMechanic(event.target.value)
              resetPage()
            }}
            placeholder="Nombre"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="rounded-md px-3 py-2 font-semibold text-blue-700 underline disabled:text-slate-400"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Cargando órdenes…</p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600">
          {hasFilters
            ? 'No se encontraron órdenes con esos criterios.'
            : 'Todavía no hay órdenes de trabajo registradas.'}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-[1050px] divide-y divide-slate-200 text-left text-sm">
              <caption className="sr-only">Órdenes de trabajo registradas</caption>
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3" scope="col">
                    Orden
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Ingreso
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Cliente
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Placa
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Vehículo
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Problema
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Mecánico
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Estado
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap px-4 py-4 font-bold">{order.numeroOrden}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(order.fechaIngreso)}
                    </td>
                    <td className="px-4 py-4">{order.cliente.name}</td>
                    <td className="whitespace-nowrap px-4 py-4">{order.vehiculo.plate ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {order.vehiculo.make} {order.vehiculo.model}
                    </td>
                    <td className="max-w-xs truncate px-4 py-4">{order.descripcionProblema}</td>
                    <td className="px-4 py-4">{order.mecanicoResponsable ?? 'Sin asignar'}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <StatusBadge status={order.estado} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <Link
                        className="font-semibold text-blue-700 underline"
                        to={`/admin/ordenes/${order.id}`}
                      >
                        Consultar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold">{order.numeroOrden}</h2>
                    <p className="text-sm text-slate-600">{formatDate(order.fechaIngreso)}</p>
                  </div>
                  <StatusBadge status={order.estado} />
                </div>
                <p className="mt-3 font-semibold">{order.cliente.name}</p>
                <p className="text-sm text-slate-600">
                  {order.vehiculo.plate ?? 'Sin placa'} · {order.vehiculo.make}{' '}
                  {order.vehiculo.model}
                </p>
                <p className="mt-2 text-sm">{order.descripcionProblema}</p>
                <Link
                  className="mt-3 inline-block font-semibold text-blue-700 underline"
                  to={`/admin/ordenes/${order.id}`}
                >
                  Consultar detalle
                </Link>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Mostrando {firstResult}–{lastResult} de {total} órdenes
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPage((value) => value - 1)
                  setLoading(true)
                  setError('')
                }}
                disabled={page <= 1 || loading}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-slate-600">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPage((value) => value + 1)
                  setLoading(true)
                  setError('')
                }}
                disabled={page >= totalPages || loading}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function WorkOrderDetail({ accessToken, id }: { accessToken: string; id: string }) {
  const [order, setOrder] = useState<AdminWorkOrderDetails | null>(null)
  const [history, setHistory] = useState<WorkOrderStatusHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [nextStatus, setNextStatus] = useState<WorkOrderStatus | ''>('')
  const [observations, setObservations] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void getAdminWorkOrder(accessToken, id)
      .then((result) => {
        if (active) setOrder(result)
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'No se pudo consultar la orden.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accessToken, id])

  useEffect(() => {
    let active = true
    void getWorkOrderStatusHistory(accessToken, id)
      .then((records) => {
        if (active) setHistory(records)
      })
      .catch((cause: unknown) => {
        if (active)
          setHistoryError(
            cause instanceof Error ? cause.message : 'No se pudo cargar el historial.',
          )
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })
    return () => {
      active = false
    }
  }, [accessToken, id])

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!order || !nextStatus) return
    setSaving(true)
    setError('')
    setHistoryError('')
    setSaveMessage('')
    try {
      const updated = await updateWorkOrderStatus(accessToken, id, {
        estadoActual: order.estado,
        estado: nextStatus,
        observaciones: observations.trim() || null,
      })
      setOrder(updated)
      setObservations('')
      setNextStatus('')
      setSaveMessage('El estado se actualizó y quedó registrado en el historial.')
      try {
        setHistory(await getWorkOrderStatusHistory(accessToken, id))
      } catch (cause) {
        setHistoryError(
          cause instanceof Error ? cause.message : 'No se pudo actualizar el historial.',
        )
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p role="status">Cargando detalle de la orden…</p>
  if (error && !order)
    return (
      <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
        {error}
      </p>
    )
  if (!order) return null

  return (
    <section className="max-w-4xl space-y-5">
      <Link to="/admin/ordenes" className="inline-block font-semibold text-blue-700 underline">
        ← Volver al listado
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
              Orden de trabajo
            </p>
            <h2 className="mt-1 text-2xl font-black">{order.numeroOrden}</h2>
          </div>
          <StatusBadge status={order.estado} />
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <DetailItem label="Fecha de ingreso" value={formatDate(order.fechaIngreso, true)} />
          <DetailItem label="Fecha de creación" value={formatDate(order.fechaCreacion, true)} />
        </dl>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold">Estado de la orden</h3>
        <p className="mb-4 flex items-center gap-2">
          <span className="font-semibold">Estado actual:</span>
          <StatusBadge status={order.estado} />
        </p>
        {availableWorkOrderTransitions[order.estado].length > 0 ? (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void saveStatus(event)}>
            <label className="text-sm font-semibold">
              Nuevo estado
              <select
                required
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value as WorkOrderStatus | '')}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              >
                <option value="">Selecciona un estado</option>
                {availableWorkOrderTransitions[order.estado].map((status) => (
                  <option key={status} value={status}>
                    {workOrderStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold sm:row-span-2">
              Observaciones o motivo
              <textarea
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                required={nextStatus === 'CANCELADA'}
                maxLength={2000}
                rows={3}
                placeholder={
                  nextStatus === 'CANCELADA' ? 'Motivo obligatorio para cancelar' : 'Opcional'
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving || !nextStatus}
                className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar cambio'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-slate-600">
            Esta orden ya está cerrada y no admite más cambios de estado.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-900"
          >
            {error}
          </p>
        )}
        {saveMessage && (
          <p role="status" className="mt-4 text-sm font-semibold text-green-800">
            {saveMessage}
          </p>
        )}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold">Historial de la orden</h3>
        {historyError && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-900"
          >
            {historyError}
          </p>
        )}
        {historyLoading ? (
          <p role="status">Cargando historial…</p>
        ) : history.length === 0 ? (
          <p className="text-slate-600">Todavía no hay cambios de estado registrados.</p>
        ) : (
          <ol className="space-y-4 border-l-2 border-slate-200 pl-5">
            {history.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[1.63rem] top-1 h-3 w-3 rounded-full bg-blue-700" />
                <p className="font-semibold">
                  {workOrderStatusLabels[entry.estadoAnterior]} →{' '}
                  {workOrderStatusLabels[entry.estadoNuevo]}
                </p>
                <p className="text-sm text-slate-600">
                  {formatDate(entry.fechaCambio, true)} ·{' '}
                  {entry.usuario.displayName || entry.usuario.userId}
                </p>
                {entry.observaciones && (
                  <p className="mt-1 whitespace-pre-wrap text-sm">{entry.observaciones}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">Cliente</h3>
          <dl className="space-y-3">
            <DetailItem label="Nombre" value={order.cliente.name} />
            <DetailItem label="Teléfono" value={order.cliente.phone || 'No disponible'} />
            <DetailItem label="Correo" value={order.cliente.email ?? 'No disponible'} />
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">Vehículo</h3>
          <dl className="space-y-3">
            <DetailItem label="Placa" value={order.vehiculo.plate ?? 'No registrada'} />
            <DetailItem
              label="Marca y modelo"
              value={`${order.vehiculo.make} ${order.vehiculo.model}`}
            />
            <DetailItem label="Año" value={String(order.vehiculo.year)} />
            <DetailItem
              label="Kilometraje"
              value={
                order.kilometraje === null
                  ? 'No registrado'
                  : `${order.kilometraje.toLocaleString('es-HN')} km`
              }
            />
          </dl>
        </section>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold">Información del trabajo</h3>
        <dl className="space-y-4">
          <DetailItem label="Problema reportado" value={order.descripcionProblema} />
          <DetailItem label="Observaciones" value={order.observaciones ?? 'Sin observaciones'} />
          <DetailItem
            label="Mecánico responsable"
            value={order.mecanicoResponsable ?? 'Sin asignar'}
          />
        </dl>
      </section>
      <WorkOrderRecords accessToken={accessToken} order={order} />
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-bold">Cita relacionada</h3>
        {order.cita ? (
          <dl className="space-y-3">
            <DetailItem label="Servicio" value={order.cita.service.name} />
            <DetailItem label="Fecha" value={formatDate(order.cita.requestedAt, true)} />
            <DetailItem label="Estado de la cita" value={order.cita.status} />
          </dl>
        ) : (
          <p className="text-slate-600">Esta orden no está asociada a una cita.</p>
        )}
      </section>
    </section>
  )
}

function WorkOrderRecords({
  accessToken,
  order,
}: {
  accessToken: string
  order: AdminWorkOrderDetails
}) {
  const [diagnosis, setDiagnosis] = useState<WorkOrderDiagnosis | null>(null)
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [total, setTotal] = useState('0.00')
  const [audit, setAudit] = useState<WorkOrderRecordAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [diagnosisFields, setDiagnosisFields] = useState({
    diagnostico: '',
    causaIdentificada: '',
    recomendaciones: '',
    observaciones: '',
  })
  const emptyTask: WorkTaskInput = {
    nombre: '',
    descripcion: '',
    cantidad: '1',
    precioUnitario: '0.00',
    mecanicoResponsable: order.mecanicoResponsable ?? '',
  }
  const [taskFields, setTaskFields] = useState<WorkTaskInput>(emptyTask)
  const [editingTask, setEditingTask] = useState<WorkTask | null>(null)
  const readOnly = order.estado === 'FINALIZADA' || order.estado === 'CANCELADA'

  async function loadRecords() {
    const [diagnosisResult, tasksResult, auditResult] = await Promise.all([
      getWorkOrderDiagnosis(accessToken, order.id),
      getWorkOrderTasks(accessToken, order.id),
      getWorkOrderRecordAudit(accessToken, order.id),
    ])
    setDiagnosis(diagnosisResult)
    setDiagnosisFields({
      diagnostico: diagnosisResult?.diagnostico ?? '',
      causaIdentificada: diagnosisResult?.causaIdentificada ?? '',
      recomendaciones: diagnosisResult?.recomendaciones ?? '',
      observaciones: diagnosisResult?.observaciones ?? '',
    })
    setTasks(tasksResult.trabajos)
    setTotal(tasksResult.totalManoObra)
    setAudit(auditResult)
  }

  useEffect(() => {
    let active = true
    void Promise.resolve()
      .then(() => loadRecords())
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudieron cargar diagnóstico y trabajos.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // loadRecords intentionally uses the order id/token as its data boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, order.id])

  async function refreshAfterWrite(success: string) {
    setError('')
    setMessage('')
    try {
      await loadRecords()
      setMessage(success)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Se guardó, pero no se pudo recargar la información.',
      )
    }
  }

  async function saveDiagnosis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await saveWorkOrderDiagnosis(accessToken, order.id, {
        diagnostico: diagnosisFields.diagnostico,
        causaIdentificada: diagnosisFields.causaIdentificada.trim() || null,
        recomendaciones: diagnosisFields.recomendaciones.trim() || null,
        observaciones: diagnosisFields.observaciones.trim() || null,
      })
      await refreshAfterWrite('El diagnóstico quedó guardado con su trazabilidad.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el diagnóstico.')
    } finally {
      setSaving(false)
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editingTask) {
        await updateWorkOrderTask(accessToken, order.id, editingTask.id, {
          ...taskFields,
          descripcion: taskFields.descripcion?.trim() || null,
          mecanicoResponsable: taskFields.mecanicoResponsable?.trim() || null,
          fechaActualizacionEsperada: editingTask.fechaActualizacion,
        })
      } else {
        await createWorkOrderTask(accessToken, order.id, {
          ...taskFields,
          descripcion: taskFields.descripcion?.trim() || null,
          mecanicoResponsable: taskFields.mecanicoResponsable?.trim() || null,
          idempotencyKey: crypto.randomUUID(),
        })
      }
      setEditingTask(null)
      setTaskFields(emptyTask)
      await refreshAfterWrite(
        editingTask ? 'El trabajo se actualizó.' : 'El trabajo quedó registrado.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el trabajo.')
    } finally {
      setSaving(false)
    }
  }

  async function retireTask(task: WorkTask) {
    if (
      !window.confirm(
        `¿Retirar “${task.nombre}” del total de mano de obra? El registro se conservará en el historial.`,
      )
    )
      return
    setSaving(true)
    setError('')
    try {
      await removeWorkOrderTask(accessToken, order.id, task.id, task.fechaActualizacion)
      await refreshAfterWrite('El trabajo fue retirado del total y conservado en la auditoría.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo retirar el trabajo.')
    } finally {
      setSaving(false)
    }
  }

  function beginEdit(task: WorkTask) {
    setEditingTask(task)
    setTaskFields({
      nombre: task.nombre,
      descripcion: task.descripcion ?? '',
      cantidad: task.cantidad,
      precioUnitario: task.precioUnitario,
      mecanicoResponsable: task.mecanicoResponsable ?? '',
    })
  }

  const money = (value: string) =>
    new Intl.NumberFormat('es-HN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value))

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-lg font-bold">Diagnóstico del vehículo</h3>
        <p className="mb-4 text-sm text-slate-600">
          Problema reportado por el cliente: <strong>{order.descripcionProblema}</strong>
        </p>
        <p className="mb-3 text-sm text-slate-600">
          Mecánico responsable: <strong>{order.mecanicoResponsable ?? 'Sin asignar'}</strong>
          {diagnosis && (
            <>
              {' '}
              · Fecha del diagnóstico: {formatDate(diagnosis.fechaDiagnostico, true)} · Registró{' '}
              {diagnosis.usuarioRegistro.displayName || diagnosis.usuarioRegistro.userId}; última
              actualización {formatDate(diagnosis.fechaActualizacion, true)} por{' '}
              {diagnosis.usuarioActualizacion.displayName || diagnosis.usuarioActualizacion.userId}.
            </>
          )}
        </p>
        {loading ? (
          <p role="status">Cargando diagnóstico…</p>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void saveDiagnosis(event)}
          >
            <label className="text-sm font-semibold sm:col-span-2">
              Diagnóstico técnico *
              <textarea
                required
                maxLength={4000}
                rows={3}
                disabled={readOnly}
                value={diagnosisFields.diagnostico}
                onChange={(event) =>
                  setDiagnosisFields({ ...diagnosisFields, diagnostico: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Causa identificada
              <textarea
                maxLength={2000}
                rows={2}
                disabled={readOnly}
                value={diagnosisFields.causaIdentificada}
                onChange={(event) =>
                  setDiagnosisFields({ ...diagnosisFields, causaIdentificada: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Reparaciones recomendadas
              <textarea
                maxLength={2000}
                rows={2}
                disabled={readOnly}
                value={diagnosisFields.recomendaciones}
                onChange={(event) =>
                  setDiagnosisFields({ ...diagnosisFields, recomendaciones: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Observaciones del mecánico
              <textarea
                maxLength={2000}
                rows={2}
                disabled={readOnly}
                value={diagnosisFields.observaciones}
                onChange={(event) =>
                  setDiagnosisFields({ ...diagnosisFields, observaciones: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            {!readOnly && (
              <button
                disabled={saving}
                className="w-fit rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? 'Guardando…'
                  : diagnosis
                    ? 'Actualizar diagnóstico'
                    : 'Guardar diagnóstico'}
              </button>
            )}
          </form>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold">Trabajos realizados</h3>
        {loading ? (
          <p role="status">Cargando trabajos…</p>
        ) : tasks.length === 0 ? (
          <p className="mb-4 text-slate-600">Todavía no hay trabajos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-2">Trabajo</th>
                  <th className="p-2">Cantidad</th>
                  <th className="p-2">Precio unitario</th>
                  <th className="p-2">Subtotal</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-slate-100">
                    <td className="p-2">
                      <strong>{task.nombre}</strong>
                      {task.descripcion && <p className="text-slate-600">{task.descripcion}</p>}
                      {task.mecanicoResponsable && (
                        <p className="text-xs text-slate-500">
                          Mecánico: {task.mecanicoResponsable}
                        </p>
                      )}
                    </td>
                    <td className="p-2">{task.cantidad}</td>
                    <td className="p-2">{money(task.precioUnitario)}</td>
                    <td className="p-2">{money(task.subtotal)}</td>
                    <td className="p-2">
                      {!readOnly && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => beginEdit(task)}
                            className="text-blue-700 underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void retireTask(task)}
                            className="text-red-700 underline"
                          >
                            Retirar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-right text-lg font-bold">Total mano de obra: HNL {money(total)}</p>
        {!readOnly && (
          <form
            className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2"
            onSubmit={(event) => void saveTask(event)}
          >
            <h4 className="font-bold sm:col-span-2">
              {editingTask ? 'Editar trabajo' : 'Agregar trabajo'}
            </h4>
            <label className="text-sm font-semibold">
              Nombre *
              <input
                required
                maxLength={150}
                value={taskFields.nombre}
                onChange={(event) => setTaskFields({ ...taskFields, nombre: event.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Descripción
              <textarea
                maxLength={2000}
                value={taskFields.descripcion ?? ''}
                onChange={(event) =>
                  setTaskFields({ ...taskFields, descripcion: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Cantidad *
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={taskFields.cantidad}
                onChange={(event) => setTaskFields({ ...taskFields, cantidad: event.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Precio unitario (HNL) *
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={taskFields.precioUnitario}
                onChange={(event) =>
                  setTaskFields({ ...taskFields, precioUnitario: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Mecánico responsable
              <input
                maxLength={150}
                value={taskFields.mecanicoResponsable ?? ''}
                onChange={(event) =>
                  setTaskFields({ ...taskFields, mecanicoResponsable: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <div className="flex items-end gap-3">
              <button
                disabled={saving}
                className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Guardando…' : editingTask ? 'Guardar edición' : 'Agregar trabajo'}
              </button>
              {editingTask && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditingTask(null)
                    setTaskFields(emptyTask)
                  }}
                  className="text-slate-700 underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        )}
      </section>
      {(error || message) && (
        <p
          role={error ? 'alert' : 'status'}
          className={
            error
              ? 'rounded-md border border-red-300 bg-red-50 p-3 text-red-900'
              : 'text-sm font-semibold text-green-800'
          }
        >
          {error || message}
        </p>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold">Historial de modificaciones</h3>
        {loading ? (
          <p role="status">Cargando auditoría…</p>
        ) : audit.length === 0 ? (
          <p className="text-slate-600">Todavía no hay modificaciones de diagnóstico o trabajos.</p>
        ) : (
          <ol className="space-y-3">
            {audit.map((entry) => (
              <li key={entry.id} className="border-l-2 border-blue-200 pl-3">
                <p className="font-semibold">
                  {entry.tipo === 'DIAGNOSTICO' ? 'Diagnóstico' : 'Trabajo'} ·{' '}
                  {entry.accion.toLowerCase()}
                </p>
                <p className="text-sm text-slate-600">
                  {formatDate(entry.fechaCambio, true)} ·{' '}
                  {entry.usuario.displayName || entry.usuario.userId}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

const workOrderStatusLabels: Record<WorkOrderStatus, string> = {
  ABIERTA: 'Abierta',
  EN_DIAGNOSTICO: 'En diagnóstico',
  EN_PROCESO: 'En proceso',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
}

const availableWorkOrderTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  ABIERTA: ['EN_DIAGNOSTICO', 'CANCELADA'],
  EN_DIAGNOSTICO: ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['FINALIZADA', 'CANCELADA'],
  FINALIZADA: [],
  CANCELADA: [],
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
    </div>
  )
}

function StatusBadge({ status }: { status: AdminWorkOrderListItem['estado'] }) {
  const styles: Record<AdminWorkOrderListItem['estado'], string> = {
    ABIERTA: 'bg-blue-50 text-blue-800',
    EN_DIAGNOSTICO: 'bg-amber-50 text-amber-800',
    EN_PROCESO: 'bg-violet-50 text-violet-800',
    FINALIZADA: 'bg-green-50 text-green-800',
    CANCELADA: 'bg-red-50 text-red-800',
  }
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles[status]}`}>
      {workOrderStatusLabels[status]}
    </span>
  )
}

function formatDate(value: string, time = false) {
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'medium',
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(value))
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
