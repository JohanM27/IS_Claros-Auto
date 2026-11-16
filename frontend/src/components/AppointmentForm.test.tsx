// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AppointmentForm } from './AppointmentForm'
import { getLocalDateValue, validateAppointment } from '../utils/appointmentValidation'
import type { AppointmentFormValues } from '../types/appointment'

afterEach(cleanup)

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
  await user.selectOptions(screen.getByLabelText(/servicio solicitado/i), 'Cambio de aceite')
  fireEvent.change(screen.getByLabelText(/fecha preferida/i), {
    target: { value: getLocalDateValue() },
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
      service: 'Cambio de aceite',
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

  it('valida el correo cuando se proporciona', async () => {
    const user = userEvent.setup()
    renderForm()
    await completeRequiredFields(user)
    await user.type(screen.getByLabelText(/correo electrónico/i), 'correo-no-valido')
    await user.click(screen.getByRole('button', { name: /enviar solicitud/i }))

    expect(screen.getByRole('alert').textContent).toContain('Escribe un correo electrónico válido.')
  })

  it('acepta el correo opcional vacío y muestra una confirmación de demostración', async () => {
    const user = userEvent.setup()
    renderForm()
    await completeRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /enviar solicitud/i }))

    expect(screen.getByRole('status').textContent).toContain('no constituye una cita confirmada')
    expect((screen.getByLabelText(/nombre completo/i) as HTMLInputElement).value).toBe('')
  })
})
