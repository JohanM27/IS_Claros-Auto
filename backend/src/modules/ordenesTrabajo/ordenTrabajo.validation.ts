import { HttpError } from '../../utils/httpError.js'

export function validarVehiculoDelCliente(coincide: boolean) {
  if (!coincide) {
    throw new HttpError(
      400,
      'VEHICLE_CUSTOMER_MISMATCH',
      'El vehículo no pertenece al cliente seleccionado.',
    )
  }
}

export function validarCitaDisponible(coincide: boolean) {
  if (!coincide) {
    throw new HttpError(
      400,
      'APPOINTMENT_ORDER_MISMATCH',
      'La cita no corresponde al cliente y vehículo seleccionados, no está activa o ya tiene una orden.',
    )
  }
}
