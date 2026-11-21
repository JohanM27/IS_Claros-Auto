// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkOrdersPage } from './WorkOrdersPage'

const mocks = vi.hoisted(() => ({
  session: { access_token: 'access-token' } as { access_token: string } | null,
  identity: vi.fn(),
  list: vi.fn(),
  customerSearch: vi.fn(),
  appointments: vi.fn(),
  createOrder: vi.fn(),
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
  searchWorkOrderCustomers: mocks.customerSearch,
  getWorkOrderAppointments: mocks.appointments,
  createWorkOrder: mocks.createOrder,
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
      kilometraje: 85000,
      estado: 'ABIERTA',
      fechaIngreso: '2026-11-19T10:00:00.000Z',
      fechaCreacion: '2026-11-19T10:00:00.000Z',
      fechaActualizacion: '2026-11-19T10:00:00.000Z',
      cliente: { name: 'Johan Moreno', phone: '97000000' },
      vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: null },
    },
  ])
  mocks.customerSearch.mockResolvedValue([
    {
      id: 'customer-1',
      name: 'Johan Moreno',
      phone: '97000000',
      email: null,
      vehicles: [{ id: 'vehicle-1', make: 'Ford', model: 'Escape', year: 2017, plate: 'ABC123' }],
    },
  ])
  mocks.appointments.mockResolvedValue([])
  mocks.createOrder.mockResolvedValue({
    id: 'work-order-2',
    numeroOrden: 'OT-000002',
    clienteId: 'customer-1',
    vehiculoId: 'vehicle-1',
    citaId: null,
    descripcionProblema: 'Ruido al frenar',
    observaciones: null,
    mecanicoResponsable: null,
    kilometraje: null,
    estado: 'ABIERTA',
    fechaIngreso: '2026-11-20T12:00:00.000Z',
    fechaCreacion: '2026-11-20T12:00:00.000Z',
    fechaActualizacion: '2026-11-20T12:00:00.000Z',
    cliente: { name: 'Johan Moreno', phone: '97000000' },
    vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: 'ABC123' },
  })
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/ordenes']}>
      <Routes>
        <Route path="/admin/ordenes" element={<WorkOrdersPage />} />
        <Route path="/admin/ordenes/nueva" element={<WorkOrdersPage />} />
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

  it('crea una orden seleccionando un cliente y uno de sus vehículos', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/ordenes/nueva']}>
        <Routes>
          <Route path="/admin/ordenes/nueva" element={<WorkOrdersPage />} />
          <Route path="/login" element={<p>Redirigido al inicio de sesión</p>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.type(await screen.findByLabelText(/buscar cliente/i), 'Johan')
    await user.click(screen.getByRole('button', { name: 'Buscar cliente' }))
    await user.click(await screen.findByRole('button', { name: /Johan Moreno/ }))
    await user.selectOptions(screen.getByLabelText('Vehículo'), 'vehicle-1')
    await user.type(screen.getByLabelText('Problema reportado'), 'Ruido al frenar')
    await user.click(screen.getByRole('button', { name: 'Registrar orden de trabajo' }))

    expect((await screen.findByRole('status')).textContent).toContain(
      'OT-000002 registrada correctamente',
    )
    expect(mocks.createOrder).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({ clienteId: 'customer-1', vehiculoId: 'vehicle-1' }),
    )
  })

  it('no muestra el formulario si la cuenta carece de perfil autorizado', async () => {
    mocks.identity.mockRejectedValue(new Error('No autorizado'))
    render(
      <MemoryRouter initialEntries={['/admin/ordenes/nueva']}>
        <Routes>
          <Route path="/admin/ordenes/nueva" element={<WorkOrdersPage />} />
          <Route path="/login" element={<p>Redirigido al inicio de sesión</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Nueva orden de trabajo' })).toBeNull()
  })
})
