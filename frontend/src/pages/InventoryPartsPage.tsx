import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminNavigation } from '../components/AdminNavigation'
import { PageMetadata } from '../components/PageMetadata'
import {
  createInventoryPart,
  getInventoryCategories,
  getInventoryPart,
  getInventoryParts,
  setInventoryPartActive,
  updateInventoryPart,
  type InventoryCategory,
  type InventoryPart,
  type InventoryPartInput,
  type InventoryPartPage,
} from '../services/api'

const PAGE_SIZE = 10
const units = [
  ['UNIDAD', 'Unidad'],
  ['LITRO', 'Litro'],
  ['GALON', 'Galón'],
  ['MILILITRO', 'Mililitro'],
  ['KILOGRAMO', 'Kilogramo'],
  ['GRAMO', 'Gramo'],
  ['METRO', 'Metro'],
  ['JUEGO', 'Juego'],
  ['PAR', 'Par'],
  ['CAJA', 'Caja'],
  ['BOTELLA', 'Botella'],
] as const

type FormValues = {
  nombre: string
  descripcion: string
  categoriaId: string
  marca: string
  numeroParte: string
  codigoBarras: string
  unidadMedida: string
  precioCompra: string
  precioVenta: string
  stockMinimo: string
}
const emptyForm: FormValues = {
  nombre: '',
  descripcion: '',
  categoriaId: '',
  marca: '',
  numeroParte: '',
  codigoBarras: '',
  unidadMedida: 'UNIDAD',
  precioCompra: '',
  precioVenta: '',
  stockMinimo: '0',
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}
function formatMoney(value: string | number) {
  return new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(
    Number(value),
  )
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium' }).format(new Date(value))
}
function toForm(item: InventoryPart): FormValues {
  return {
    nombre: item.nombre,
    descripcion: item.descripcion ?? '',
    categoriaId: item.categoriaId,
    marca: item.marca ?? '',
    numeroParte: item.numeroParte ?? '',
    codigoBarras: item.codigoBarras ?? '',
    unidadMedida: item.unidadMedida,
    precioCompra: item.precioCompra ?? '',
    precioVenta: item.precioVenta,
    stockMinimo: item.stockMinimo,
  }
}
function toInput(values: FormValues): InventoryPartInput {
  return {
    nombre: values.nombre.trim(),
    descripcion: values.descripcion.trim() || null,
    categoriaId: values.categoriaId,
    marca: values.marca.trim() || null,
    numeroParte: values.numeroParte.trim() || null,
    codigoBarras: values.codigoBarras.trim() || null,
    unidadMedida: values.unidadMedida,
    precioCompra: values.precioCompra,
    precioVenta: values.precioVenta,
    stockMinimo: values.stockMinimo,
  }
}
function grossMargin(values: FormValues) {
  const purchaseCents = Math.round(Number(values.precioCompra) * 100)
  const saleCents = Math.round(Number(values.precioVenta) * 100)
  if (!values.precioCompra || !values.precioVenta || saleCents === 0) return null
  return {
    profit: (saleCents - purchaseCents) / 100,
    margin: ((saleCents - purchaseCents) / saleCents) * 100,
  }
}

export function InventoryPartsPage() {
  const { session, employee, employeeLoading, loading, signOut } = useAuth()
  const token = session?.access_token
  const isAdmin = employee?.role === 'ADMINISTRADOR'
  const isReception = employee?.role === 'RECEPCIONISTA'
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [status, setStatus] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('ACTIVOS')
  const [pageNumber, setPageNumber] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [lookup, setLookup] = useState<{
    key: string
    result: InventoryPartPage | null
    error: string
  } | null>(null)
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<InventoryPart | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const createIdempotencyKey = useRef<string | null>(null)
  const [detail, setDetail] = useState<InventoryPart | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!token || employeeLoading || (!isAdmin && !isReception)) return
    let active = true
    void getInventoryCategories(token, { estado: 'ACTIVAS', pageSize: 50 })
      .then((result) => {
        if (active) setCategories(result.data)
      })
      .catch(() => {
        if (active) setCategories([])
      })
    return () => {
      active = false
    }
  }, [token, employeeLoading, isAdmin, isReception])

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      categoriaId: categoryId || undefined,
      marca: brand.trim() || undefined,
      estado: isReception ? ('ACTIVOS' as const) : status,
      page: pageNumber,
      pageSize: PAGE_SIZE,
    }),
    [debouncedQuery, categoryId, brand, isReception, status, pageNumber],
  )
  const requestKey =
    token && !employeeLoading && (isAdmin || isReception)
      ? `${token}|${JSON.stringify(filters)}|${refresh}`
      : ''

  useEffect(() => {
    if (!token || !requestKey) return
    let active = true
    void getInventoryParts(token, filters)
      .then((result) => {
        if (active) setLookup({ key: requestKey, result, error: '' })
      })
      .catch((error: unknown) => {
        if (active) setLookup({ key: requestKey, result: null, error: errorMessage(error) })
      })
    return () => {
      active = false
    }
  }, [token, requestKey, filters])

  const current = lookup?.key === requestKey ? lookup : null
  const result = current?.result ?? null
  const margin = grossMargin(values)

  function setField(field: keyof FormValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
  }
  function beginCreate() {
    setEditing(null)
    setValues(emptyForm)
    setActionError('')
    setNotice('')
    setShowForm(true)
  }
  function beginEdit(item: InventoryPart) {
    setEditing(item)
    setValues(toForm(item))
    setActionError('')
    setNotice('')
    setShowForm(true)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setActionError('')
    setNotice('')
    try {
      if (editing) {
        await updateInventoryPart(token, editing.id, toInput(values))
        setNotice('El repuesto se actualizó correctamente.')
      } else {
        createIdempotencyKey.current ??= crypto.randomUUID()
        const created = await createInventoryPart(
          token,
          toInput(values),
          createIdempotencyKey.current,
        )
        createIdempotencyKey.current = null
        setNotice(`Repuesto registrado con SKU ${created.sku}.`)
        setPageNumber(1)
      }
      setShowForm(false)
      setEditing(null)
      setRefresh((value) => value + 1)
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }
  async function changeActive(item: InventoryPart) {
    if (!token) return
    const next = !item.activo
    if (!window.confirm(`¿Confirmas ${next ? 'reactivar' : 'desactivar'} «${item.nombre}»?`)) return
    setActionError('')
    setNotice('')
    try {
      await setInventoryPartActive(token, item.id, next)
      setNotice(`El repuesto se ${next ? 'reactivó' : 'desactivó'} correctamente.`)
      setRefresh((value) => value + 1)
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }
  async function showDetails(item: InventoryPart) {
    if (!token) return
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      setDetail(await getInventoryPart(token, item.id))
    } catch (error) {
      setDetailError(errorMessage(error))
    } finally {
      setDetailLoading(false)
    }
  }
  function clearFilters() {
    setQuery('')
    setDebouncedQuery('')
    setCategoryId('')
    setBrand('')
    setStatus('ACTIVOS')
    setPageNumber(1)
  }

  if (loading) return <main className="p-10 text-center">Verificando sesión…</main>
  if (!session)
    return (
      <Navigate to="/login" replace state={{ from: { pathname: '/admin/inventario/repuestos' } }} />
    )
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 sm:px-8">
      <PageMetadata
        title="Repuestos"
        description="Catálogo de repuestos de Claros Auto."
        indexable={false}
      />
      <div className="mx-auto max-w-6xl">
        <AdminNavigation title="Repuestos" employee={employee} onSignOut={() => void signOut()} />
        {employeeLoading ? (
          <p role="status">Verificando permisos…</p>
        ) : !isAdmin && !isReception ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
            Esta cuenta no tiene permiso para consultar repuestos.
          </p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-lg text-slate-600">
                  Catálogo, identificación y disponibilidad de productos.
                </p>
                <Link
                  className="mt-2 inline-block font-semibold text-blue-700 underline"
                  to="/admin/inventario"
                >
                  Volver al inventario
                </Link>
              </div>
              {isAdmin && (
                <button
                  onClick={beginCreate}
                  className="rounded-md bg-blue-700 px-4 py-3 font-semibold text-white"
                >
                  Nuevo repuesto
                </button>
              )}
            </div>
            {(notice || actionError || current?.error) && (
              <p
                role={actionError || current?.error ? 'alert' : 'status'}
                className={`mb-4 rounded-md border p-4 ${actionError || current?.error ? 'border-red-300 bg-red-50 text-red-900' : 'border-green-300 bg-green-50 text-green-900'}`}
              >
                {actionError || current?.error || notice}
              </p>
            )}
            {showForm && isAdmin && (
              <form
                onSubmit={(event) => void submit(event)}
                className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="mb-4 text-xl font-bold">
                  {editing ? 'Editar repuesto' : 'Nuevo repuesto'}
                </h2>
                <h3 className="mb-2 font-semibold">Información general</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1">
                    Nombre *
                    <input
                      required
                      maxLength={180}
                      value={values.nombre}
                      onChange={(e) => setField('nombre', e.target.value)}
                      className="rounded-md border p-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    Categoría *
                    <select
                      required
                      value={values.categoriaId}
                      onChange={(e) => setField('categoriaId', e.target.value)}
                      className="rounded-md border p-2"
                    >
                      <option value="">Selecciona una categoría activa</option>
                      {categories
                        .filter((category) => category.activo)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.nombre}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    Descripción
                    <textarea
                      maxLength={2000}
                      value={values.descripcion}
                      onChange={(e) => setField('descripcion', e.target.value)}
                      className="rounded-md border p-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    Marca
                    <input
                      maxLength={100}
                      value={values.marca}
                      onChange={(e) => setField('marca', e.target.value)}
                      className="rounded-md border p-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    Número de parte
                    <input
                      maxLength={100}
                      value={values.numeroParte}
                      onChange={(e) => setField('numeroParte', e.target.value)}
                      className="rounded-md border p-2"
                    />
                  </label>
                </div>
                <h3 className="mb-2 mt-5 font-semibold">Identificación e información comercial</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-1">
                    SKU
                    <input
                      readOnly
                      value={editing?.sku ?? 'Se genera al guardar'}
                      className="rounded-md border bg-slate-100 p-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    Código de barras
                    <input
                      maxLength={80}
                      value={values.codigoBarras}
                      onChange={(e) => setField('codigoBarras', e.target.value)}
                      className="rounded-md border p-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    Unidad de medida *
                    <select
                      required
                      disabled={Boolean(editing && Number(editing.stockActual) > 0)}
                      value={values.unidadMedida}
                      onChange={(e) => setField('unidadMedida', e.target.value)}
                      className="rounded-md border p-2"
                    >
                      {units.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    Precio de compra (HNL) *
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.precioCompra}
                      onChange={(e) => setField('precioCompra', e.target.value)}
                      className="rounded-md border p-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    Precio de venta (HNL) *
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.precioVenta}
                      onChange={(e) => setField('precioVenta', e.target.value)}
                      className="rounded-md border p-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    Stock mínimo *
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.001"
                      value={values.stockMinimo}
                      onChange={(e) => setField('stockMinimo', e.target.value)}
                      className="rounded-md border p-2"
                    />
                  </label>
                </div>
                {margin && (
                  <p
                    className={`mt-3 text-sm ${margin.profit < 0 ? 'text-amber-800' : 'text-slate-600'}`}
                  >
                    Ganancia bruta estimada: {formatMoney(margin.profit.toFixed(2))} · Margen:{' '}
                    {margin.margin.toFixed(2)}%
                    {margin.profit < 0 ? ' · El precio de venta está por debajo del costo.' : ''}
                  </p>
                )}
                <p className="mt-3 text-sm text-slate-600">
                  El stock inicial es 0. Las existencias se registrarán más adelante mediante
                  movimientos.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    disabled={saving}
                    className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar repuesto'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-md border px-4 py-2"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            <section
              aria-label="Filtros de repuestos"
              className="mb-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2 lg:grid-cols-4"
            >
              <label className="grid gap-1 lg:col-span-2">
                Buscar nombre, SKU, código de barras, parte o marca
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPageNumber(1)
                  }}
                  placeholder="Ej. REP-00001 o 001234…"
                  className="rounded-md border p-2"
                />
              </label>
              <label className="grid gap-1">
                Categoría
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value)
                    setPageNumber(1)
                  }}
                  className="rounded-md border p-2"
                >
                  <option value="">Todas las categorías activas</option>
                  {categories
                    .filter((category) => category.activo)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nombre}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1">
                Marca
                <input
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value)
                    setPageNumber(1)
                  }}
                  className="rounded-md border p-2"
                />
              </label>
              {isAdmin && (
                <label className="grid gap-1">
                  Estado
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as typeof status)
                      setPageNumber(1)
                    }}
                    className="rounded-md border p-2"
                  >
                    <option value="TODOS">Todos</option>
                    <option value="ACTIVOS">Activos</option>
                    <option value="INACTIVOS">Inactivos</option>
                  </select>
                </label>
              )}
              <button
                onClick={clearFilters}
                className="self-end text-left font-semibold text-blue-700 underline"
              >
                Limpiar filtros
              </button>
            </section>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {[
                      'SKU',
                      'Producto',
                      'Categoría',
                      'Marca / parte',
                      ...(isAdmin ? ['Compra'] : []),
                      'Venta',
                      'Stock',
                      'Estado',
                      'Acciones',
                    ].map((label) => (
                      <th key={label} className="px-3 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-3 font-mono">{item.sku}</td>
                      <td className="px-3 py-3">{item.nombre}</td>
                      <td className="px-3 py-3">{item.categoria.nombre}</td>
                      <td className="px-3 py-3">
                        {[item.marca, item.numeroParte].filter(Boolean).join(' · ') || '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-3">
                          {item.precioCompra === undefined ? '—' : formatMoney(item.precioCompra)}
                        </td>
                      )}
                      <td className="px-3 py-3">{formatMoney(item.precioVenta)}</td>
                      <td className="px-3 py-3">
                        {item.stockActual} {item.unidadMedida}
                      </td>
                      <td className="px-3 py-3">{item.activo ? 'Activo' : 'Inactivo'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void showDetails(item)}
                            className="text-blue-700 underline"
                          >
                            Ver
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => beginEdit(item)}
                                className="text-blue-700 underline"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => void changeActive(item)}
                                className="text-blue-700 underline"
                              >
                                {item.activo ? 'Desactivar' : 'Reactivar'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!result || result.data.length === 0) && (
                <p className="p-6 text-slate-600">
                  {current?.error
                    ? 'No se pudo cargar el catálogo.'
                    : 'No hay repuestos para mostrar.'}
                </p>
              )}
              {requestKey && !current && (
                <p role="status" className="p-4 text-slate-500">
                  Cargando repuestos…
                </p>
              )}
            </div>
            {result && (
              <nav
                aria-label="Paginación de repuestos"
                className="mt-4 flex items-center justify-between"
              >
                <span>
                  {result.pagination.total} repuestos · Página {result.pagination.page} de{' '}
                  {result.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber((n) => n - 1)}
                    className="rounded border px-3 py-2 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={pageNumber >= result.pagination.totalPages}
                    onClick={() => setPageNumber((n) => n + 1)}
                    className="rounded border px-3 py-2 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </nav>
            )}
            {(detail || detailLoading || detailError) && (
              <section
                className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                aria-label="Detalle del repuesto"
              >
                <div className="flex justify-between">
                  <h2 className="text-xl font-bold">Detalle del repuesto</h2>
                  <button
                    onClick={() => {
                      setDetail(null)
                      setDetailError('')
                    }}
                    aria-label="Cerrar detalle"
                  >
                    Cerrar
                  </button>
                </div>
                {detailLoading && <p role="status">Cargando detalle…</p>}
                {detailError && <p role="alert">{detailError}</p>}
                {detail && (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <dt>Nombre</dt>
                    <dd>{detail.nombre}</dd>
                    <dt>Descripción</dt>
                    <dd>{detail.descripcion || '—'}</dd>
                    <dt>SKU</dt>
                    <dd>{detail.sku}</dd>
                    <dt>Código de barras</dt>
                    <dd>{detail.codigoBarras || '—'}</dd>
                    <dt>Categoría</dt>
                    <dd>{detail.categoria.nombre}</dd>
                    <dt>Marca / número de parte</dt>
                    <dd>{[detail.marca, detail.numeroParte].filter(Boolean).join(' / ') || '—'}</dd>
                    <dt>Precio de venta</dt>
                    <dd>{formatMoney(detail.precioVenta)}</dd>
                    {isAdmin && detail.precioCompra !== undefined && (
                      <>
                        <dt>Precio de compra</dt>
                        <dd>{formatMoney(detail.precioCompra)}</dd>
                        <dt>Ganancia bruta estimada</dt>
                        <dd>
                          {formatMoney(
                            (Math.round(Number(detail.precioVenta) * 100) -
                              Math.round(Number(detail.precioCompra) * 100)) /
                              100,
                          )}
                        </dd>
                        <dt>Margen bruto estimado</dt>
                        <dd>
                          {Number(detail.precioVenta) === 0
                            ? 'No aplicable'
                            : `${(((Number(detail.precioVenta) - Number(detail.precioCompra)) / Number(detail.precioVenta)) * 100).toFixed(2)}%`}
                        </dd>
                      </>
                    )}
                    <dt>Existencias / mínimo</dt>
                    <dd>
                      {detail.stockActual} / {detail.stockMinimo} {detail.unidadMedida}
                    </dd>
                    <dt>Estado</dt>
                    <dd>{detail.activo ? 'Activo' : 'Inactivo'}</dd>
                    <dt>Creado / actualizado</dt>
                    <dd>
                      {formatDate(detail.fechaCreacion)} / {formatDate(detail.fechaActualizacion)}
                    </dd>
                  </dl>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
