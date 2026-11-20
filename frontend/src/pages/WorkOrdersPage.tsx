import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminNavigation } from '../components/AdminNavigation'
import { PageMetadata } from '../components/PageMetadata'
import {
  ApiError,
  getAdminWorkOrders,
  getEmployeeIdentity,
  type AdminWorkOrder,
  type EmployeeIdentity,
} from '../services/api'

export function WorkOrdersPage() {
  const { session, loading: authLoading, signOut } = useAuth()
  const [employee, setEmployee] = useState<EmployeeIdentity | null>(null)
  const [workOrders, setWorkOrders] = useState<AdminWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        setWorkOrders(await getAdminWorkOrders(session.access_token))
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
  }, [session])

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
                    <td className="whitespace-nowrap px-4 py-4 font-bold">{order.numeroOrden}</td>
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
      </div>
    </main>
  )
}
