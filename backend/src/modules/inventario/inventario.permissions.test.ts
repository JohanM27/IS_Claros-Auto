import { describe, expect, it } from 'vitest'
import { canReadInventory, canReadInventoryCosts } from './inventario.permissions.js'

describe('permisos de inventario', () => {
  it('permite consultar inventario a administración y recepción', () => {
    expect(canReadInventory('ADMINISTRADOR')).toBe(true)
    expect(canReadInventory('RECEPCIONISTA')).toBe(true)
  })

  it('reserva los costos de compra a administración', () => {
    expect(canReadInventoryCosts('ADMINISTRADOR')).toBe(true)
    expect(canReadInventoryCosts('RECEPCIONISTA')).toBe(false)
  })

  it('rechaza perfiles sin rol autorizado', () => {
    expect(canReadInventory('MECANICO')).toBe(false)
    expect(canReadInventory(null)).toBe(false)
    expect(canReadInventoryCosts(undefined)).toBe(false)
  })
})
