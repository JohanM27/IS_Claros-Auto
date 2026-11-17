import { describe, expect, it } from 'vitest'
import { calculateEstimate as calculateSickEstimate } from '../enfermo.js'
import { calculateEstimate } from '../sano.js'

const validEstimate = {
  laborHours: 3,
  hourlyRate: 500,
  partsCost: 2000,
  discountPercent: 10,
  taxPercent: 15,
}

describe('calculateEstimate — implementación corregida', () => {
  it('calcula mano de obra, repuestos, descuento e impuesto en orden', () => {
    expect(calculateEstimate(validEstimate)).toBe(3622.5)
  })

  it('acepta porcentajes en los límites y devuelve cero para un presupuesto vacío', () => {
    expect(
      calculateEstimate({
        laborHours: 0,
        hourlyRate: 0,
        partsCost: 0,
        discountPercent: 100,
        taxPercent: 0,
      }),
    ).toBe(0)
  })

  it('redondea el resultado a centavos', () => {
    expect(
      calculateEstimate({
        laborHours: 1,
        hourlyRate: 10.005,
        partsCost: 0,
        discountPercent: 0,
        taxPercent: 0,
      }),
    ).toBe(10.01)
  })

  it.each([
    ['horas negativas', { ...validEstimate, laborHours: -1 }, RangeError],
    ['un costo como texto', { ...validEstimate, partsCost: '2000' }, TypeError],
    [
      'un porcentaje de descuento mayor que 100',
      { ...validEstimate, discountPercent: 101 },
      RangeError,
    ],
    ['un impuesto no finito', { ...validEstimate, taxPercent: Number.NaN }, TypeError],
    ['una entrada nula', null, TypeError],
  ])('rechaza %s', (_caseName, input, errorType) => {
    expect(() => calculateEstimate(input)).toThrow(errorType)
  })
})

describe('implementación enferma — defectos reproducibles', () => {
  it('acepta valores negativos y produce un total sin sentido', () => {
    const result = calculateSickEstimate({ ...validEstimate, laborHours: -3 })
    expect(result).toBe(517.5)
    expect(() => calculateEstimate({ ...validEstimate, laborHours: -3 })).toThrow(RangeError)
  })

  it('concatena el costo de repuestos si llega como texto', () => {
    const input = { ...validEstimate, partsCost: '2000' }
    expect(calculateSickEstimate(input)).toBe(15527070)
    expect(() => calculateEstimate(input)).toThrow(TypeError)
  })

  it('permite descuentos fuera de rango y devuelve un valor inválido', () => {
    const input = { ...validEstimate, discountPercent: 150 }
    expect(calculateSickEstimate(input)).toBe(-2012.5)
    expect(() => calculateEstimate(input)).toThrow(RangeError)
  })
})
