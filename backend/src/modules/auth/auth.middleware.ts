import type { RequestHandler } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database.js'
import { HttpError } from '../../utils/httpError.js'
import type { EmployeeIdentity, VerifiedSupabaseUser } from './auth.types.js'

type VerifyAccessToken = (token: string) => Promise<VerifiedSupabaseUser | null>
type FindEmployeeProfile = (userId: string) => Promise<{
  role: EmployeeIdentity['role']
  displayName: string | null
} | null>

async function verifySupabaseAccessToken(token: string): Promise<VerifiedSupabaseUser | null> {
  const supabaseUrl = process.env.SUPABASE_URL
  const publicKey = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !publicKey) {
    throw new HttpError(503, 'AUTH_NOT_CONFIGURED', 'La autenticación no está configurada.')
  }

  let response: Response
  try {
    response = await fetch(new URL('/auth/v1/user', supabaseUrl), {
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', 'No se pudo validar la sesión.')
  }

  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) {
    throw new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', 'No se pudo validar la sesión.')
  }

  const user = (await response.json().catch(() => null)) as { id?: unknown; email?: unknown } | null
  const parsedId = z.uuid().safeParse(user?.id)
  if (!parsedId.success) return null

  return {
    id: parsedId.data,
    email: typeof user?.email === 'string' ? user.email : null,
  }
}

async function findEmployeeProfile(userId: string) {
  return prisma.staffProfile.findUnique({
    where: { userId },
    select: { role: true, displayName: true },
  })
}

export function createAuthenticateEmployee(
  dependencies: {
    verifyAccessToken?: VerifyAccessToken
    findProfile?: FindEmployeeProfile
  } = {},
): RequestHandler {
  const verify = dependencies.verifyAccessToken ?? verifySupabaseAccessToken
  const findProfile = dependencies.findProfile ?? findEmployeeProfile

  return async (request, _response, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(request.get('authorization') ?? '')
    if (!match) {
      next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.'))
      return
    }

    try {
      const user = await verify(match[1])
      if (!user) {
        next(new HttpError(401, 'INVALID_SESSION', 'La sesión no es válida o ha expirado.'))
        return
      }

      const profile = await findProfile(user.id)
      if (!profile) {
        next(
          new HttpError(
            403,
            'EMPLOYEE_ROLE_NOT_ASSIGNED',
            'La cuenta no tiene un rol de empleado asignado.',
          ),
        )
        return
      }

      request.employeeIdentity = {
        userId: user.id,
        email: user.email,
        role: profile.role,
        displayName: profile.displayName,
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

export const authenticateEmployee = createAuthenticateEmployee()

export function requireRoles(...allowedRoles: EmployeeIdentity['role'][]): RequestHandler {
  return (request, _response, next) => {
    const employee = request.employeeIdentity
    if (!employee) {
      next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.'))
      return
    }

    if (!allowedRoles.includes(employee.role)) {
      next(new HttpError(403, 'INSUFFICIENT_PERMISSIONS', 'No tienes permiso para esta acción.'))
      return
    }

    next()
  }
}
