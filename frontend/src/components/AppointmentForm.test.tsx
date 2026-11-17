// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppointmentForm } from './AppointmentForm'
import { getLocalDateValue, validateAppointment } from '../utils/appointmentValidation'
import type { AppointmentFormValues } from '../types/appointment'

const { getServices, createAppointment } = vi.hoisted(() => ({
  getServices: vi.fn(),
  createAppointment: vi.fn(),
}))

vi.mock('../services/api', () => ({ getServices, createAppointment }))

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  getServices.mockResolvedValue([
    { id: 'svc-1', slug: 'cambio-aceite', name: 'Cambio de aceite', description: 'Servicio' },
  ])
  createAppointment.mockResolvedValue({
    id: 'appointment-1',
    status: 'PENDIENTE',
    requestedAt: '2030-01-02T16:30:00.000Z',
    createdAt: '2030-01-01T10:00:00.000Z',
    service: { id: 'svc-1', name: 'Cambio de aceite' },
    lookupToken: 'a'.repeat(64),
  })
})

function renderForm(path = '/citas') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppointmentForm />
    </MemoryRouter>,
  )
}

async function completeRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nombre completo/i), 'María López')
  await user.type(screen.getByLabelText(/^teléfono/i), '+504 9999 0000')
  await user.type(screen.getByLabelText(/marca del vehículo/i), 'Toyota')
  await user.type(screen.getByLabelText(/modelo del vehículo/i), 'Corolla')
  await user.type(screen.getByLabelText(/año del vehículo/i), '2020')
  await screen.findByRole('option', { name: 'Cambio de aceite' })
  await user.selectOptions(screen.getByLabelText(/servicio solicitado/i), 'svc-1')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  fireEvent.change(screen.getByLabelText(/fecha preferida/i), {
    target: { value: getLocalDateValue(tomorrow) },
  })
  fireEvent.change(screen.getByLabelText(/hora preferida/i), {
    target: { value: '10:30' },
  })
}

describe('formulario de solicitud de cita', () => {
  it('rechaza teléfono, año, fecha y hora inválidos', () => {
    const values: AppointmentFormValues = {
      fullName: 'María López',
      phone: 'abc',
      email: '',
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehicleYear: '1700',
      service: 'svc-1',
      preferredDate: '2000-01-01',
      preferredTime: '25:99',
      notes: '',
    }

    const errors = validateAppointment(values)

    expect(errors.phone).toBeDefined()
    expect(errors.vehicleYear).toBeDefined()
    expect(errors.preferredDate).toBeDefined()
    expect(errors.preferredTime).toBeDefined()
  })

  it('muestra errores para campos obligatorios y enfoca el primero', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: /enviar solicitud/i }))

    expect(screen.getByRole('alert').textContent).toContain('Escribe tu nombre completo.')
    expect(screen.getByLabelText(/nombre completo/i).getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(screen.getByLabelText(/nombre completo/i))
  })

  it('envía la cita y comunica que quedó pendiente de confirmación', async () => {
    const user = userEvent.setup()
    renderForm('/citas?servicio=cambio-aceite')
    await completeRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /enviar solicitud/i }))

    expect((await screen.findByRole('status')).textContent).toContain('PENDIENTE')
    expect(screen.getByRole('status').textContent).toContain('No se volverá a mostrar')
    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'María López',
        service: 'svc-1',
      }),
    )
    expect((screen.getByLabelText(/nombre completo/i) as HTMLInputElement).value).toBe('')
  })
})
