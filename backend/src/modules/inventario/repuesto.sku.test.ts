import { describe, expect, it } from 'vitest'
import { formatSku } from './repuesto.sku.js'

describe('SKU de repuestos', () => {
  it('formatea identificadores secuenciales y mantiene ceros a la izquierda', () => {
    expect(formatSku(1n)).toBe('REP-00001')
    expect(formatSku(42n)).toBe('REP-00042')
    expect(formatSku(100000n)).toBe('REP-100000')
  })

  it('no acepta valores que no provengan de una secuencia positiva', () => {
    expect(() => formatSku(0n)).toThrow(RangeError)
    expect(() => formatSku(-1n)).toThrow(RangeError)
  })
})
