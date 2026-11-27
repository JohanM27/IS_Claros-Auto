import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminNavigation } from '../components/AdminNavigation'
import { PageMetadata } from '../components/PageMetadata'
import { getAdminInventorySummary, type AdminInventorySummary } from '../services/api'

const inventorySections = [
  { title: 'Repuestos', description: 'Catálogo, SKU y disponibilidad.', to: null },
  {
    title: 'Categorías',
    description: 'Organización de repuestos.',
    to: '/admin/inventario/categorias',
  },
  { title: 'Proveedores', description: 'Directorio de proveedores.', to: null },
  { title: 'Movimientos', description: 'Entradas, salidas e historial.', to: null },
]

function formatInventoryValue(value: string) {
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'HNL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export function InventoryPage() {
  const { session, employee, employeeLoading, loading, signOut } = useAuth()
  const accessToken = session?.access_token
  const [summaryLookup, setSummaryLookup] = useState<{
    accessToken: string
    summary: AdminInventorySummary | null
    error: string
  } | null>(null)

  useEffect(() => {
    if (!accessToken || employeeLoading || !employee) return
    if (employee.role !== 'ADMINISTRADOR' && employee.role !== 'RECEPCIONISTA') return
    let active = true
    void getAdminInventorySummary(accessToken)
      .then((summary) => {
        if (active) setSummaryLookup({ accessToken, summary, error: '' })
      })
      .catch((cause: unknown) => {
        if (active) {
          setSummaryLookup({
            accessToken,
            summary: null,
            error: cause instanceof Error ? cause.message : 'No se pudo verificar el rol.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [accessToken, employee, employeeLoading])

  const currentSummary = summaryLookup?.accessToken === accessToken ? summaryLookup : null
  const summary = currentSummary?.summary ?? null
  const summaryLoading = Boolean(accessToken && employee && !employeeLoading && !currentSummary)

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
            Esta cuenta no tiene un rol autorizado para consultar el inventario.
          </p>
        ) : (
          <>
            <p className="mb-6 text-lg text-slate-600">
              Consulta de repuestos, categorías, proveedores y movimientos del taller.
            </p>
            {currentSummary?.error && (
              <p
                role="alert"
                className="mb-5 rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
              >
                {currentSummary.error}
              </p>
            )}
            <section aria-labelledby="inventory-indicators" className="mb-8">
              <h2 id="inventory-indicators" className="mb-4 text-xl font-bold">
                Indicadores
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Total de repuestos', value: summary?.totalRepuestos },
                  { label: 'Productos activos', value: summary?.productosActivos },
                  { label: 'Productos con stock bajo', value: summary?.productosStockBajo },
                  { label: 'Productos agotados', value: summary?.productosAgotados },
                  ...(employee.role === 'ADMINISTRADOR'
                    ? [{ label: 'Valor del inventario', value: summary?.valorInventario }]
                    : []),
                ].map(({ label, value }) => (
                  <article
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-semibold">{label}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {summaryLoading
                        ? 'Cargando…'
                        : currentSummary?.error
                          ? 'No disponible'
                          : value === undefined
                            ? '—'
                            : label === 'Valor del inventario'
                              ? formatInventoryValue(String(value))
                              : value}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <section aria-labelledby="inventory-sections">
              <h2 id="inventory-sections" className="mb-4 text-xl font-bold">
                Secciones del inventario
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {inventorySections.map(({ title, description, to }) => (
                  <article
                    key={title}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h3 className="text-lg font-bold">{title}</h3>
                    <p className="mt-1 text-slate-600">{description}</p>
                    <p className="mt-4 text-sm font-semibold text-slate-500">
                      {to ? (
                        <Link className="text-blue-700 underline" to={to}>
                          Administrar categorías
                        </Link>
                      ) : (
                        'Disponible en un siguiente avance'
                      )}
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
