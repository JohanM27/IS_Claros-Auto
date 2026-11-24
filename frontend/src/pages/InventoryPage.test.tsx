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
  getEmployee: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../services/api', () => ({ getEmployeeIdentity: auth.getEmployee }))

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
  auth.getEmployee.mockImplementation(() => Promise.resolve(auth.employee))
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
  it('muestra indicadores pendientes y no inventa cantidades', async () => {
    renderInventory()
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeTruthy()
    expect(screen.getByText('Total de repuestos')).toBeTruthy()
    expect(screen.getAllByText('Pendiente de conectar').length).toBeGreaterThan(0)
    expect(screen.getByText('Valor del inventario')).toBeTruthy()
    expect(screen.queryByText(/\b\d+ repuestos?\b/i)).toBeNull()
  })

  it('permite la consulta a recepción y oculta el indicador de costos', async () => {
    auth.employee = { ...auth.employee!, role: 'RECEPCIONISTA' }
    auth.getEmployee.mockImplementation(() => Promise.resolve(auth.employee))
    renderInventory()
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeTruthy()
    expect(screen.queryByText('Valor del inventario')).toBeNull()
  })

  it('bloquea perfiles no autorizados', async () => {
    auth.employee = { ...auth.employee!, role: 'MECANICO' }
    auth.getEmployee.mockImplementation(() => Promise.resolve(auth.employee))
    renderInventory()
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('redirige al login si no hay sesión', () => {
    auth.session = null
    renderInventory()
    expect(screen.queryByRole('heading', { name: 'Inventario' })).toBeNull()
  })
})
