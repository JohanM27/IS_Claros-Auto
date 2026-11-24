import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminNavigation } from '../components/AdminNavigation'
import { PageMetadata } from '../components/PageMetadata'
import { getEmployeeIdentity, type EmployeeIdentity } from '../services/api'

const inventorySections = [
  { title: 'Repuestos', description: 'Catálogo, SKU y disponibilidad.' },
  { title: 'Categorías', description: 'Organización de repuestos.' },
  { title: 'Proveedores', description: 'Directorio de proveedores.' },
  { title: 'Movimientos', description: 'Entradas, salidas e historial.' },
]

export function InventoryPage() {
  const { session, loading, signOut } = useAuth()
  const accessToken = session?.access_token
  const [identityLookup, setIdentityLookup] = useState<{
    accessToken: string
    employee: EmployeeIdentity | null
    error: string
  } | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let active = true
    void getEmployeeIdentity(accessToken)
      .then((identity) => {
        if (!active) return
        if (identity.role !== 'ADMINISTRADOR' && identity.role !== 'RECEPCIONISTA') {
          setIdentityLookup({
            accessToken,
            employee: null,
            error: 'Esta cuenta no tiene un rol autorizado para consultar el inventario.',
          })
          return
        }
        setIdentityLookup({ accessToken, employee: identity, error: '' })
      })
      .catch((cause: unknown) => {
        if (active) {
          setIdentityLookup({
            accessToken,
            employee: null,
            error: cause instanceof Error ? cause.message : 'No se pudo verificar el rol.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [accessToken])

  const currentIdentity = identityLookup?.accessToken === accessToken ? identityLookup : null
  const employee = currentIdentity?.employee ?? null
  const employeeLoading = Boolean(accessToken && !currentIdentity)

  if (loading) return <main className="p-10 text-center">Verificando sesión…</main>
  if (!session)
    return <Navigate to="/login" replace state={{ from: { pathname: '/admin/inventario' } }} />

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 sm:px-8">
      <PageMetadata
        title="Inventario"
        description="Panel privado del inventario de Claros Auto."
        indexable={false}
      />
      <div className="mx-auto max-w-6xl">
        <AdminNavigation title="Inventario" employee={employee} onSignOut={() => void signOut()} />
        {employeeLoading ? (
          <p role="status">Verificando permisos…</p>
        ) : !employee || employee.role === 'MECANICO' ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
            {currentIdentity?.error ||
              'Esta cuenta no tiene un rol autorizado para consultar el inventario.'}
          </p>
        ) : (
          <>
            <p className="mb-6 text-lg text-slate-600">
              Consulta de repuestos, categorías, proveedores y movimientos del taller.
            </p>
            <section aria-labelledby="inventory-indicators" className="mb-8">
              <h2 id="inventory-indicators" className="mb-4 text-xl font-bold">
                Indicadores
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  'Total de repuestos',
                  'Productos activos',
                  'Productos con stock bajo',
                  'Productos agotados',
                  ...(employee.role === 'ADMINISTRADOR' ? ['Valor del inventario'] : []),
                ].map((label) => (
                  <article
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-semibold">{label}</h3>
                    <p className="mt-2 text-sm text-slate-500">Pendiente de conectar</p>
                  </article>
                ))}
              </div>
            </section>
            <section aria-labelledby="inventory-sections">
              <h2 id="inventory-sections" className="mb-4 text-xl font-bold">
                Secciones del inventario
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {inventorySections.map(({ title, description }) => (
                  <article
                    key={title}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h3 className="text-lg font-bold">{title}</h3>
                    <p className="mt-1 text-slate-600">{description}</p>
                    <p className="mt-4 text-sm font-semibold text-slate-500">
                      Disponible en un siguiente avance
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
