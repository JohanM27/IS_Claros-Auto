import type { StaffRole } from '../../generated/prisma/client.js'

export type EmployeeIdentity = {
  userId: string
  email: string | null
  role: StaffRole
  displayName: string | null
}

export type VerifiedSupabaseUser = {
  id: string
  email: string | null
}

declare module 'express-serve-static-core' {
  interface Request {
    employeeIdentity?: EmployeeIdentity
  }
}
