// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkOrdersPage } from './WorkOrdersPage'

const mocks = vi.hoisted(() => ({
  session: { access_token: 'access-token' } as { access_token: string } | null,
  identity: vi.fn(),
  list: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, loading: false, signOut: mocks.signOut }),
}))

vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message)
    }
  },
  getEmployeeIdentity: mocks.identity,
  getAdminWorkOrders: mocks.list,
}))

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = { access_token: 'access-token' }
  mocks.identity.mockResolvedValue({
    id: 'employee-1',
    email: 'recepcion@example.com',
    role: 'RECEPCIONISTA',
    displayName: 'Recepción',
  })
  mocks.list.mockResolvedValue([
    {
      id: 'work-order-1',
      numeroOrden: 'OT-0001',
      clienteId: 'customer-1',
      vehiculoId: 'vehicle-1',
      citaId: null,
      descripcionProblema: 'Ruido al frenar',
      observaciones: null,
      mecanicoResponsable: 'Carlos Pérez',
      estado: 'ABIERTA',
      fechaIngreso: '2026-11-19T10:00:00.000Z',
      fechaCreacion: '2026-11-19T10:00:00.000Z',
      fechaActualizacion: '2026-11-19T10:00:00.000Z',
      cliente: { name: 'Johan Moreno', phone: '97000000' },
      vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: null },
    },
  ])
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/ordenes']}>
      <Routes>
        <Route path="/admin/ordenes" element={<WorkOrdersPage />} />
        <Route path="/login" element={<p>Redirigido al inicio de sesión</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('página de órdenes de trabajo', () => {
  it.each(['ADMINISTRADOR', 'RECEPCIONISTA'] as const)(
    'permite consultar órdenes a %s',
    async (role) => {
      mocks.identity.mockResolvedValue({
        id: 'employee-1',
        email: 'empleado@example.com',
        role,
        displayName: role,
      })

      renderPage()

      expect(await screen.findByText('OT-0001')).toBeTruthy()
      expect(screen.getByText('Ruido al frenar')).toBeTruthy()
      expect(screen.getByRole('navigation', { name: 'Navegación administrativa' })).toBeTruthy()
      expect(mocks.list).toHaveBeenCalledWith('access-token')
    },
  )

  it('muestra un estado vacío cuando no hay órdenes registradas', async () => {
    mocks.list.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Todavía no hay órdenes de trabajo registradas.')).toBeTruthy()
  })

  it('no consulta órdenes para perfiles sin rol administrativo autorizado', async () => {
    mocks.identity.mockRejectedValue(
      new Error('El acceso al sistema está reservado para administración y recepción.'),
    )
    renderPage()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('redirige a login cuando no existe sesión', () => {
    mocks.session = null
    renderPage()

    expect(screen.getByText('Redirigido al inicio de sesión')).toBeTruthy()
    expect(mocks.list).not.toHaveBeenCalled()
  })
})
