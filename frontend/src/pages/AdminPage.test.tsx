// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from './AdminPage'

const mocks = vi.hoisted(() => ({
  session: { access_token: 'token' },
  identity: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
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
  getAdminAppointments: mocks.list,
  setAppointmentStatus: mocks.update,
}))

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.identity.mockResolvedValue({
    id: 'employee-1',
    email: 'recepcion@example.com',
    role: 'RECEPCIONISTA',
    displayName: 'Recepción',
  })
  mocks.list.mockResolvedValue([
    {
      id: 'appointment-1',
      status: 'PENDIENTE',
      requestedAt: '2030-01-01T16:00:00.000Z',
      createdAt: '2029-12-01T12:00:00.000Z',
      notes: null,
      customer: { name: 'María López', phone: '+504 9999 0000', email: null },
      vehicle: { make: 'Toyota', model: 'Corolla', year: 2020 },
      service: { name: 'Diagnóstico' },
    },
  ])
  mocks.update.mockResolvedValue({
    id: 'appointment-1',
    status: 'CONFIRMADA',
    requestedAt: '2030-01-01T16:00:00.000Z',
    createdAt: '2029-12-01T12:00:00.000Z',
  })
})

function renderAdmin() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  )
}

describe('panel administrativo', () => {
  it('consulta el API con la sesión y presenta la solicitud de cita', async () => {
    renderAdmin()
    expect(await screen.findByText('María López')).toBeTruthy()
    expect(mocks.identity).toHaveBeenCalledWith('token')
    expect(mocks.list).toHaveBeenCalledWith('token')
  })

  it('envía la confirmación al API y actualiza el estado presentado', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))
    expect(mocks.update).toHaveBeenCalledWith('token', 'appointment-1', 'CONFIRMADA')
    expect(await screen.findByText('CONFIRMADA')).toBeTruthy()
  })

  it('permite cerrar la sesión desde el panel', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('explica cuando la cuenta no tiene perfil autorizado', async () => {
    mocks.identity.mockRejectedValue(new Error('sin rol'))
    renderAdmin()
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
