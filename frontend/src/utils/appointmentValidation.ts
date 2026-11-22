import type { AppointmentErrors, AppointmentFormValues } from '../types/appointment'

export function getLocalDateValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function validatePreferredDateTime(
  values: AppointmentFormValues,
): Pick<AppointmentErrors, 'preferredDate' | 'preferredTime'> {
  const errors: Pick<AppointmentErrors, 'preferredDate' | 'preferredTime'> = {}

  if (!values.preferredDate) {
    errors.preferredDate = 'Selecciona una fecha preferida.'
  } else {
    const parsedDate = new Date(`${values.preferredDate}T00:00:00`)
    if (
      Number.isNaN(parsedDate.getTime()) ||
      getLocalDateValue(parsedDate) !== values.preferredDate
    ) {
      errors.preferredDate = 'Selecciona una fecha válida.'
    } else if (values.preferredDate < getLocalDateValue()) {
      errors.preferredDate = 'La fecha debe ser hoy o una fecha futura.'
    } else if (values.preferredTime) {
      const requestedAt = new Date(`${values.preferredDate}T${values.preferredTime}:00`)
      if (requestedAt.getTime() <= Date.now()) {
        errors.preferredTime = 'La hora debe ser posterior a la hora actual.'
      }
    }
  }

  if (!values.preferredTime) {
    errors.preferredTime = 'Selecciona una hora preferida.'
  } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.preferredTime)) {
    errors.preferredTime = 'Selecciona una hora válida.'
  }

  return errors
}

export function validateAppointment(values: AppointmentFormValues): AppointmentErrors {
  const errors: AppointmentErrors = {}

  if (!values.fullName.trim()) errors.fullName = 'Escribe tu nombre completo.'

  const phoneDigits = values.phone.replace(/\D/g, '')
  if (!values.phone.trim()) {
    errors.phone = 'Escribe tu número de teléfono.'
  } else if (!/^[+\d\s().-]+$/.test(values.phone) || phoneDigits.length < 7) {
    errors.phone = 'Escribe un teléfono válido con al menos 7 dígitos.'
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Escribe un correo electrónico válido.'
  }

  if (!values.vehicleMake.trim()) errors.vehicleMake = 'Escribe la marca del vehículo.'
  if (!values.vehicleModel.trim()) errors.vehicleModel = 'Escribe el modelo del vehículo.'

  const vehicleYear = Number(values.vehicleYear)
  if (!values.vehicleYear) {
    errors.vehicleYear = 'Escribe el año del vehículo.'
  } else if (
    !Number.isInteger(vehicleYear) ||
    vehicleYear < 1886 ||
    vehicleYear > new Date().getFullYear() + 1
  ) {
    errors.vehicleYear = 'Escribe un año válido para el vehículo.'
  }

  if (!values.service) errors.service = 'Selecciona el servicio que necesitas.'
  Object.assign(errors, validatePreferredDateTime(values))

  return errors
}
