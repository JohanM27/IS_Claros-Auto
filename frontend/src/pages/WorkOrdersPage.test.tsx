// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkOrdersPage } from './WorkOrdersPage'

const mocks = vi.hoisted(() => ({
  session: { access_token: 'access-token' } as { access_token: string } | null,
  identity: vi.fn(),
  list: vi.fn(),
  getOrder: vi.fn(),
  history: vi.fn(),
  updateStatus: vi.fn(),
  getDiagnosis: vi.fn(),
  saveDiagnosis: vi.fn(),
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  removeTask: vi.fn(),
  recordAudit: vi.fn(),
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
  getAdminWorkOrder: mocks.getOrder,
  getWorkOrderStatusHistory: mocks.history,
  updateWorkOrderStatus: mocks.updateStatus,
  getWorkOrderDiagnosis: mocks.getDiagnosis,
  saveWorkOrderDiagnosis: mocks.saveDiagnosis,
  getWorkOrderTasks: mocks.getTasks,
  createWorkOrderTask: mocks.createTask,
  updateWorkOrderTask: mocks.updateTask,
  removeWorkOrderTask: mocks.removeTask,
  getWorkOrderRecordAudit: mocks.recordAudit,
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
  mocks.list.mockResolvedValue({
    data: [
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
        vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: 'ABC123' },
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
  })
  mocks.getOrder.mockResolvedValue({
    id: 'work-order-1',
    numeroOrden: 'OT-0001',
    clienteId: 'customer-1',
    vehiculoId: 'vehicle-1',
    citaId: null,
    descripcionProblema: 'Ruido al frenar',
    observaciones: 'Revisar frenos',
    mecanicoResponsable: 'Carlos Pérez',
    kilometraje: 85000,
    estado: 'ABIERTA',
    fechaIngreso: '2026-11-19T10:00:00.000Z',
    fechaCreacion: '2026-11-19T10:00:00.000Z',
    fechaActualizacion: '2026-11-19T10:00:00.000Z',
    cliente: { name: 'Johan Moreno', phone: '97000000', email: 'johan@example.com' },
    vehiculo: { make: 'Ford', model: 'Escape', year: 2017, plate: 'ABC123' },
    cita: null,
  })
  mocks.history.mockResolvedValue([])
  mocks.getDiagnosis.mockResolvedValue(null)
  mocks.getTasks.mockResolvedValue({ trabajos: [], totalManoObra: '0.00', moneda: 'HNL' })
  mocks.recordAudit.mockResolvedValue([])
  mocks.saveDiagnosis.mockResolvedValue({})
  mocks.createTask.mockResolvedValue({ trabajo: { id: 'task-1' }, duplicate: false })
  mocks.updateTask.mockResolvedValue({})
  mocks.removeTask.mockResolvedValue({})
  mocks.updateStatus.mockImplementation(async (_token, _id, input) => ({
    ...(await mocks.getOrder()),
    estado: input.estado,
  }))
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
        <Route path="/admin/ordenes/:id" element={<WorkOrdersPage />} />
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

      expect((await screen.findAllByText('OT-0001')).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Ruido al frenar').length).toBeGreaterThan(0)
      expect(screen.getByRole('navigation', { name: 'Navegación administrativa' })).toBeTruthy()
      expect(mocks.list).toHaveBeenCalledWith('access-token', { page: 1, pageSize: 10 })
    },
  )

  it('muestra un estado vacío cuando no hay órdenes registradas', async () => {
    mocks.list.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    })
    renderPage()

    expect(await screen.findByText('Todavía no hay órdenes de trabajo registradas.')).toBeTruthy()
  })

  it('consulta una orden y muestra su detalle', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/ordenes/work-order-1']}>
        <Routes>
          <Route path="/admin/ordenes/:id" element={<WorkOrdersPage />} />
          <Route path="/login" element={<p>Redirigido al inicio de sesión</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'OT-0001' })).toBeTruthy()
    expect(screen.getByText('Johan Moreno')).toBeTruthy()
    expect(screen.getByText('Revisar frenos')).toBeTruthy()
    expect(mocks.getOrder).toHaveBeenCalledWith('access-token', 'work-order-1')
  })

  it('separa el problema reportado del diagnóstico técnico y lo guarda', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/ordenes/work-order-1']}>
        <Routes>
          <Route path="/admin/ordenes/:id" element={<WorkOrdersPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Diagnóstico del vehículo' })).toBeTruthy()
    expect(screen.getAllByText('Ruido al frenar').length).toBeGreaterThanOrEqual(2)
    await user.type(screen.getByLabelText('Diagnóstico técnico *'), 'Pastillas desgastadas')
    await user.type(screen.getByLabelText('Reparaciones recomendadas'), 'Reemplazar pastillas')
    await user.click(screen.getByRole('button', { name: 'Guardar diagnóstico' }))

    await screen.findByText('El diagnóstico quedó guardado con su trazabilidad.')
    expect(mocks.saveDiagnosis).toHaveBeenCalledWith('access-token', 'work-order-1', {
      diagnostico: 'Pastillas desgastadas',
      causaIdentificada: null,
      recomendaciones: 'Reemplazar pastillas',
      observaciones: null,
    })
  })

  it('registra trabajos desde el panel y vuelve a consultar el total del backend', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/ordenes/work-order-1']}>
        <Routes>
          <Route path="/admin/ordenes/:id" element={<WorkOrdersPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByText('Todavía no hay trabajos registrados.')
    await user.type(screen.getByLabelText('Nombre *'), 'Cambio de aceite')
    await user.clear(screen.getByLabelText('Precio unitario (HNL) *'))
    await user.type(screen.getByLabelText('Precio unitario (HNL) *'), '450.00')
    await user.click(screen.getByRole('button', { name: 'Agregar trabajo' }))

    await screen.findByText('El trabajo quedó registrado.')
    expect(mocks.createTask).toHaveBeenCalledWith(
      'access-token',
      'work-order-1',
      expect.objectContaining({
        nombre: 'Cambio de aceite',
        cantidad: '1',
        precioUnitario: '450.00',
        idempotencyKey: expect.any(String),
      }),
    )
    expect(mocks.getTasks).toHaveBeenCalledTimes(2)
  })

  it('permite actualizar el estado y refresca el historial de auditoría', async () => {
    const user = userEvent.setup()
    mocks.history.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'history-1',
        estadoAnterior: 'ABIERTA',
        estadoNuevo: 'EN_DIAGNOSTICO',
        observaciones: 'Inicia revisión',
        fechaCambio: '2026-11-20T10:00:00.000Z',
        usuario: { userId: 'employee-1', displayName: 'Recepción' },
      },
    ])
    render(
      <MemoryRouter initialEntries={['/admin/ordenes/work-order-1']}>
        <Routes>
          <Route path="/admin/ordenes/:id" element={<WorkOrdersPage />} />
          <Route path="/login" element={<p>Redirigido al inicio de sesión</p>} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('Todavía no hay cambios de estado registrados.')
    await user.selectOptions(screen.getByLabelText('Nuevo estado'), 'EN_DIAGNOSTICO')
    await user.type(screen.getByLabelText('Observaciones o motivo'), 'Inicia revisión')
    await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))

    expect(
      await screen.findByText('El estado se actualizó y quedó registrado en el historial.'),
    ).toBeTruthy()
    expect(screen.getByText('Abierta → En diagnóstico')).toBeTruthy()
    expect(screen.getAllByText('Inicia revisión').length).toBeGreaterThan(0)
    expect(mocks.updateStatus).toHaveBeenCalledWith('access-token', 'work-order-1', {
      estadoActual: 'ABIERTA',
      estado: 'EN_DIAGNOSTICO',
      observaciones: 'Inicia revisión',
    })
  })

  it('envía filtros combinados y cambia de página en el listado', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findAllByText('OT-0001')
    mocks.list.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    })
    await user.type(screen.getByRole('searchbox', { name: /buscar por número/i }), 'ABC123')
    await user.selectOptions(screen.getByLabelText('Estado'), 'ABIERTA')

    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith('access-token', {
        q: 'ABC123',
        estado: 'ABIERTA',
        fechaDesde: undefined,
        fechaHasta: undefined,
        mecanico: undefined,
        page: 1,
        pageSize: 10,
      })
    })
    expect(await screen.findByText('No se encontraron órdenes con esos criterios.')).toBeTruthy()
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
    expect(screen.queryByRole('button', { name: 'Registrar orden de trabajo' })).toBeNull()
  })
})
