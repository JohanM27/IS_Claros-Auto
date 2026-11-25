// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { InventoryPage } from './InventoryPage'

const auth = vi.hoisted(() => ({
  session: { access_token: 'access-token' } as { access_token: string } | null,
  employee: {
    id: 'employee-1',
    email: 'employee@example.com',
    role: 'ADMINISTRADOR',
    displayName: 'Johan',
  } as { id: string; email: string; role: string; displayName: string } | null,
  loading: false,
  employeeLoading: false,
  signOut: vi.fn(),
  getSummary: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../services/api', () => ({ getAdminInventorySummary: auth.getSummary }))

beforeEach(() => {
  auth.session = { access_token: 'access-token' }
  auth.employee = {
    id: 'employee-1',
    email: 'employee@example.com',
    role: 'ADMINISTRADOR',
    displayName: 'Johan',
  }
  auth.loading = false
  auth.employeeLoading = false
  auth.getSummary.mockResolvedValue({
    totalRepuestos: 12,
    productosActivos: 10,
    productosStockBajo: 2,
    productosAgotados: 1,
    valorInventario: '3450.75',
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderInventory() {
  return render(
    <MemoryRouter>
      <InventoryPage />
    </MemoryRouter>,
  )
}

describe('página de inventario', () => {
  it('muestra los indicadores recibidos del backend', async () => {
    renderInventory()
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeTruthy()
    expect(screen.getByText('Total de repuestos')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('Valor del inventario')).toBeTruthy()
    expect(screen.queryByText('Pendiente de conectar')).toBeNull()
    expect(auth.getSummary).toHaveBeenCalledWith('access-token')
  })

  it('permite la consulta a recepción y oculta el indicador de costos', async () => {
    auth.employee = { ...auth.employee!, role: 'RECEPCIONISTA' }
    renderInventory()
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeTruthy()
    expect(screen.queryByText('Valor del inventario')).toBeNull()
  })

  it('bloquea perfiles no autorizados', async () => {
    auth.employee = { ...auth.employee!, role: 'MECANICO' }
    renderInventory()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(auth.getSummary).not.toHaveBeenCalled()
  })

  it('redirige al login si no hay sesión', () => {
    auth.session = null
    renderInventory()
    expect(screen.queryByRole('heading', { name: 'Inventario' })).toBeNull()
  })
})
