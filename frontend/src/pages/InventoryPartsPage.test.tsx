// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { InventoryPartsPage } from './InventoryPartsPage'

const mocks = vi.hoisted(() => ({
  session: { access_token: 'access-token' } as { access_token: string } | null,
  employee: {
    id: 'employee-1',
    email: 'admin@example.com',
    role: 'ADMINISTRADOR',
    displayName: 'Johan',
  } as { id: string; email: string; role: string; displayName: string } | null,
  loading: false,
  employeeLoading: false,
  signOut: vi.fn(),
  categories: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setActive: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({ useAuth: () => mocks }))
vi.mock('../services/api', () => ({
  createInventoryPart: mocks.create,
  getInventoryCategories: mocks.categories,
  getInventoryPart: mocks.get,
  getInventoryParts: mocks.list,
  setInventoryPartActive: mocks.setActive,
  updateInventoryPart: mocks.update,
}))

const category = {
  id: 'category-1',
  nombre: 'Filtros',
  descripcion: null,
  activo: true,
  fechaCreacion: '2026-11-24T12:00:00.000Z',
  fechaActualizacion: '2026-11-24T12:00:00.000Z',
  _count: { repuestos: 1 },
}
const product = {
  id: 'product-1',
  sku: 'REP-00001',
  codigoBarras: '001234',
  nombre: 'Filtro de aceite',
  descripcion: null,
  categoriaId: category.id,
  categoria: { id: category.id, nombre: category.nombre, activo: true },
  marca: 'ACME',
  numeroParte: '001-A',
  unidadMedida: 'UNIDAD',
  precioCompra: '125.50',
  precioVenta: '180.00',
  stockActual: '0.000',
  stockMinimo: '2.000',
  activo: true,
  fechaCreacion: '2026-11-24T12:00:00.000Z',
  fechaActualizacion: '2026-11-24T12:00:00.000Z',
}
const page = { data: [product], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }

function renderPage() {
  return render(
    <MemoryRouter>
      <InventoryPartsPage />
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = { access_token: 'access-token' }
  mocks.employee = {
    id: 'employee-1',
    email: 'admin@example.com',
    role: 'ADMINISTRADOR',
    displayName: 'Johan',
  }
  mocks.loading = false
  mocks.employeeLoading = false
  mocks.categories.mockResolvedValue({
    data: [category],
    pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
  })
  mocks.list.mockResolvedValue(page)
  mocks.get.mockResolvedValue(product)
  mocks.create.mockResolvedValue(product)
  mocks.update.mockResolvedValue(product)
  mocks.setActive.mockResolvedValue({ ...product, activo: false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('catálogo de repuestos', () => {
  it('consulta datos del backend y muestra costos solo al administrador', async () => {
    renderPage()
    expect(await screen.findByText('REP-00001')).toBeTruthy()
    expect(screen.getByText('Filtro de aceite')).toBeTruthy()
    expect(screen.getAllByText('L 125.50').length).toBeGreaterThan(0)
    expect(mocks.list).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({ pageSize: 10, estado: 'ACTIVOS' }),
    )
  })

  it('registra un producto, muestra el SKU generado y no solicita stock inicial', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Nuevo repuesto' }))
    await user.type(screen.getByLabelText('Nombre *'), 'Filtro nuevo')
    await user.selectOptions(screen.getByLabelText('Categoría *'), category.id)
    await user.type(screen.getByLabelText('Precio de compra (HNL) *'), '12.50')
    await user.type(screen.getByLabelText('Precio de venta (HNL) *'), '19.99')
    await user.click(screen.getByRole('button', { name: 'Registrar repuesto' }))
    expect(await screen.findByText('Repuesto registrado con SKU REP-00001.')).toBeTruthy()
    expect(mocks.create).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({
        nombre: 'Filtro nuevo',
        categoriaId: category.id,
        precioCompra: '12.50',
        precioVenta: '19.99',
      }),
      expect.any(String),
    )
    expect(mocks.create.mock.calls[0][1]).not.toHaveProperty('stockActual')
  })

  it('permite a recepción buscar activos sin exponer costos ni acciones de escritura', async () => {
    mocks.employee = { ...mocks.employee!, role: 'RECEPCIONISTA' }
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('REP-00001')).toBeTruthy()
    expect(screen.queryByText('Compra')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nuevo repuesto' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    await user.type(screen.getByLabelText(/Buscar nombre/), 'REP-00001')
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        'access-token',
        expect.objectContaining({ q: 'REP-00001', estado: 'ACTIVOS' }),
      ),
    )
  })
})
