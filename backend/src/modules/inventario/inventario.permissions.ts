import type { EmployeeIdentity } from '../auth/auth.types.js'

export const INVENTORY_READ_ROLES: readonly EmployeeIdentity['role'][] = [
  'ADMINISTRADOR',
  'RECEPCIONISTA',
]
export const INVENTORY_COST_ROLES: readonly EmployeeIdentity['role'][] = ['ADMINISTRADOR']

export function canReadInventory(role: EmployeeIdentity['role'] | null | undefined) {
  return role !== undefined && role !== null && INVENTORY_READ_ROLES.includes(role)
}

export function canReadInventoryCosts(role: EmployeeIdentity['role'] | null | undefined) {
  return role !== undefined && role !== null && INVENTORY_COST_ROLES.includes(role)
}
