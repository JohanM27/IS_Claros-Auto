import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminNavigation } from '../components/AdminNavigation'
import { PageMetadata } from '../components/PageMetadata'
import {
  createInventoryCategory,
  getInventoryCategories,
  setInventoryCategoryActive,
  updateInventoryCategory,
  type InventoryCategory,
  type InventoryCategoryInput,
  type InventoryCategoryPage,
} from '../services/api'

const PAGE_SIZE = 10

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium' }).format(new Date(date))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

export function InventoryCategoriesPage() {
  const { session, employee, employeeLoading, loading, signOut } = useAuth()
  const accessToken = session?.access_token
  const isAdministrator = employee?.role === 'ADMINISTRADOR'
  const employeeRole = employee?.role
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'TODAS' | 'ACTIVAS' | 'INACTIVAS'>('TODAS')
  const [pageNumber, setPageNumber] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [listLookup, setListLookup] = useState<{
    key: string
    result: InventoryCategoryPage | null
    error: string
  } | null>(null)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<InventoryCategory | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const searchQuery = query.trim() || undefined
  const effectiveStatus = employeeRole === 'RECEPCIONISTA' ? 'ACTIVAS' : status
  const requestKey =
    accessToken && !employeeLoading && (isAdministrator || employeeRole === 'RECEPCIONISTA')
      ? `${accessToken}|${searchQuery ?? ''}|${effectiveStatus}|${pageNumber}|${refresh}`
      : ''

  useEffect(() => {
    if (!accessToken || !requestKey) return
    let active = true
    void getInventoryCategories(accessToken, {
      q: searchQuery,
      estado: effectiveStatus,
      page: pageNumber,
      pageSize: PAGE_SIZE,
    })
      .then((response) => {
        if (active) setListLookup({ key: requestKey, result: response, error: '' })
      })
      .catch((cause: unknown) => {
        if (active) setListLookup({ key: requestKey, result: null, error: getErrorMessage(cause) })
      })
    return () => {
      active = false
    }
  }, [accessToken, effectiveStatus, pageNumber, requestKey, searchQuery])

  const currentLookup = listLookup?.key === requestKey ? listLookup : null
  const result = currentLookup?.result ?? null
  const listError = currentLookup?.error ?? ''
  const loadingList = Boolean(requestKey && !currentLookup)

  function beginCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setActionError('')
    setNotice('')
    setShowForm(true)
  }

  function beginEdit(category: InventoryCategory) {
    setEditing(category)
    setName(category.nombre)
    setDescription(category.descripcion ?? '')
    setActionError('')
    setNotice('')
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditing(null)
    setActionError('')
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken) return
    const input: InventoryCategoryInput = {
      nombre: name.trim(),
      descripcion: description.trim() || null,
    }
    if (!input.nombre) {
      setActionError('Escribe el nombre de la categoría.')
      return
    }
    setSaving(true)
    setActionError('')
    setNotice('')
    try {
      if (editing) {
        await updateInventoryCategory(accessToken, editing.id, input)
        setNotice('La categoría se actualizó correctamente.')
      } else {
        await createInventoryCategory(accessToken, input)
        setNotice('La categoría se creó correctamente.')
        setPageNumber(1)
      }
      setShowForm(false)
      setEditing(null)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setActionError(getErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(category: InventoryCategory) {
    if (!accessToken) return
    const nextStatus = !category.activo
    const action = nextStatus ? 'reactivar' : 'desactivar'
    if (!window.confirm(`¿Confirmas ${action} la categoría «${category.nombre}»?`)) return
    setActionError('')
    setNotice('')
    try {
      await setInventoryCategoryActive(accessToken, category.id, nextStatus)
      setNotice(`La categoría se ${nextStatus ? 'reactivó' : 'desactivó'} correctamente.`)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setActionError(getErrorMessage(cause))
    }
  }

  if (loading) return <main className="p-10 text-center">Verificando sesión…</main>
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: '/admin/inventario/categorias' } }}
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 sm:px-8">
      <PageMetadata
        title="Categorías de repuestos"
        description="Administración de categorías del inventario de Claros Auto."
        indexable={false}
      />
      <div className="mx-auto max-w-6xl">
        <AdminNavigation
          title="Categorías de repuestos"
          employee={employee}
          onSignOut={() => void signOut()}
        />
        {employeeLoading ? (
          <p role="status">Verificando permisos…</p>
        ) : !employee ||
          (employee.role !== 'ADMINISTRADOR' && employee.role !== 'RECEPCIONISTA') ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
            Esta cuenta no tiene permiso para consultar categorías.
          </p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-lg text-slate-600">
                  Organiza los repuestos por tipo y consulta sus productos asociados.
                </p>
                <Link
                  className="mt-2 inline-block font-semibold text-blue-700 underline"
                  to="/admin/inventario"
                >
                  Volver al inventario
                </Link>
              </div>
              {isAdministrator && (
                <button
                  className="rounded-md bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800"
                  onClick={beginCreate}
                >
                  Nueva categoría
                </button>
              )}
            </div>

            {notice && (
              <p
                role="status"
                className="mb-4 rounded-md border border-green-300 bg-green-50 p-4 text-green-900"
              >
                {notice}
              </p>
            )}
            {(actionError || listError) && (
              <p
                role="alert"
                className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
              >
                {actionError || listError}
              </p>
            )}

            {showForm && isAdministrator && (
              <form
                className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                onSubmit={(event) => void submitCategory(event)}
              >
                <h2 className="mb-4 text-xl font-bold">
                  {editing ? 'Editar categoría' : 'Nueva categoría'}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 font-semibold" htmlFor="category-name">
                    Nombre *
                    <input
                      id="category-name"
                      required
                      maxLength={150}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                    />
                  </label>
                  <label className="grid gap-2 font-semibold" htmlFor="category-description">
                    Descripción (opcional)
                    <textarea
                      id="category-description"
                      maxLength={1000}
                      rows={3}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                    />
                  </label>
                </div>
                <p className="mt-2 text-sm text-slate-500">La categoría se registra activa.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear categoría'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="rounded-md border border-slate-300 px-4 py-2 font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <section
              className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              aria-label="Filtros de categorías"
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="grid gap-2 font-semibold" htmlFor="category-search">
                  Buscar por nombre
                  <input
                    id="category-search"
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPageNumber(1)
                    }}
                    placeholder="Ej. Filtros"
                    className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
                {isAdministrator ? (
                  <label className="grid gap-2 font-semibold" htmlFor="category-status">
                    Estado
                    <select
                      id="category-status"
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value as typeof status)
                        setPageNumber(1)
                      }}
                      className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                    >
                      <option value="TODAS">Todos los estados</option>
                      <option value="ACTIVAS">Activas</option>
                      <option value="INACTIVAS">Inactivas</option>
                    </select>
                  </label>
                ) : (
                  <p className="self-end text-sm text-slate-600">
                    Mostrando solo categorías activas.
                  </p>
                )}
              </div>
            </section>

            <section
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              aria-label="Listado de categorías"
            >
              {loadingList ? (
                <p role="status" className="p-6 text-slate-600">
                  Cargando categorías…
                </p>
              ) : listError && !result ? (
                <p className="p-6 text-slate-600">No se pudo cargar el listado.</p>
              ) : result?.data.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse text-left">
                    <thead className="bg-slate-100 text-sm">
                      <tr>
                        <th className="p-4">Nombre</th>
                        <th className="p-4">Descripción</th>
                        <th className="p-4">Repuestos</th>
                        <th className="p-4">Estado</th>
                        <th className="p-4">Creada</th>
                        <th className="p-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((category) => (
                        <tr key={category.id} className="border-t border-slate-200 align-top">
                          <td className="p-4 font-semibold">{category.nombre}</td>
                          <td className="max-w-sm whitespace-normal p-4 text-slate-600">
                            {category.descripcion || '—'}
                          </td>
                          <td className="p-4">{category._count.repuestos}</td>
                          <td className="p-4">
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${category.activo ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}
                            >
                              {category.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap p-4">
                            {formatDate(category.fechaCreacion)}
                          </td>
                          <td className="p-4">
                            {isAdministrator ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="rounded border border-slate-300 px-3 py-1 font-semibold hover:bg-slate-50"
                                  onClick={() => beginEdit(category)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="rounded border border-slate-300 px-3 py-1 font-semibold hover:bg-slate-50"
                                  onClick={() => void changeStatus(category)}
                                >
                                  {category.activo ? 'Desactivar' : 'Reactivar'}
                                </button>
                              </div>
                            ) : (
                              'Consulta'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-6 text-slate-600">
                  {query.trim() || status !== 'TODAS'
                    ? 'No se encontraron categorías con esos criterios.'
                    : 'Todavía no hay categorías registradas.'}
                </p>
              )}
            </section>

            {result && result.pagination.total > 0 && (
              <nav
                className="mt-4 flex flex-wrap items-center justify-between gap-3"
                aria-label="Paginación de categorías"
              >
                <p className="text-sm text-slate-600">
                  {result.pagination.total} categorías · Página {result.pagination.page} de{' '}
                  {result.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={pageNumber <= 1 || loadingList}
                    onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                    className="rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={pageNumber >= result.pagination.totalPages || loadingList}
                    onClick={() => setPageNumber((current) => current + 1)}
                    className="rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  )
}
