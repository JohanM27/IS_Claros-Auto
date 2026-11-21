import { describe, expect, it } from 'vitest'
import { formatearNumeroOrden } from './ordenTrabajo.number.js'

describe('números de órdenes', () => {
  it('formatea valores de secuencia como folios legibles', () => {
    expect(formatearNumeroOrden(1n)).toBe('OT-000001')
    expect(formatearNumeroOrden(42n)).toBe('OT-000042')
  })

  it('mantiene folios diferentes para secuencias distintas', () => {
    expect(formatearNumeroOrden(41n)).not.toBe(formatearNumeroOrden(42n))
  })
})
