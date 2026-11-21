import { describe, expect, it } from 'vitest'
import { HttpError } from '../../utils/httpError.js'
import { validarCitaDisponible, validarVehiculoDelCliente } from './ordenTrabajo.validation.js'

describe('validaciones de relaciones de la orden', () => {
  it('acepta un vehículo del cliente seleccionado', () => {
    expect(() => validarVehiculoDelCliente(true)).not.toThrow()
  })

  it('rechaza un vehículo de otro cliente', () => {
    expect(() => validarVehiculoDelCliente(false)).toThrowError(HttpError)
  })

  it('acepta una cita disponible que coincide con cliente y vehículo', () => {
    expect(() => validarCitaDisponible(true)).not.toThrow()
  })

  it('rechaza una cita incompatible, cancelada o ya asociada', () => {
    expect(() => validarCitaDisponible(false)).toThrowError(HttpError)
  })
})
