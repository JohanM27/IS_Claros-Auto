import type { RequestHandler } from 'express'
import { z } from 'zod'
import {
  AuthInvalidJwtError,
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { prisma } from '../../config/database.js'
import { HttpError } from '../../utils/httpError.js'
import type { EmployeeIdentity, VerifiedSupabaseUser } from './auth.types.js'

type VerifyAccessToken = (token: string) => Promise<VerifiedSupabaseUser | null>
type FindEmployeeProfile = (userId: string) => Promise<{
  role: EmployeeIdentity['role']
  displayName: string | null
} | null>

let supabaseAuthClient: SupabaseClient | null = null

function getSupabaseAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const publicKey = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !publicKey) {
    throw new HttpError(503, 'AUTH_NOT_CONFIGURED', 'La autenticación no está configurada.')
  }

  if (!supabaseAuthClient) {
    supabaseAuthClient = createClient(supabaseUrl, publicKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })
  }

  return supabaseAuthClient
}

async function verifySupabaseAccessToken(token: string): Promise<VerifiedSupabaseUser | null> {
  try {
    const { data, error } = await getSupabaseAuthClient().auth.getClaims(token)
    if (error) {
      if (error instanceof AuthInvalidJwtError || error.status === 401 || error.status === 403) {
        return null
      }
      throw new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', 'No se pudo validar la sesión.')
    }

    if (!data) return null
    const parsedId = z.uuid().safeParse(data.claims.sub)
    if (!parsedId.success) return null

    return {
      id: parsedId.data,
      email: typeof data.claims.email === 'string' ? data.claims.email : null,
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', 'No se pudo validar la sesión.')
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
      const requestStartedAt = performance.now()
      const user = await verify(match[1])
      const tokenVerifiedAt = performance.now()
      if (!user) {
        next(new HttpError(401, 'INVALID_SESSION', 'La sesión no es válida o ha expirado.'))
        return
      }

      const profile = await findProfile(user.id)
      const profileLoadedAt = performance.now()
      if (process.env.NODE_ENV === 'development') {
        console.info(
          `[perf] auth ${request.method} ${request.path} token=${Math.round(tokenVerifiedAt - requestStartedAt)}ms profile=${Math.round(profileLoadedAt - tokenVerifiedAt)}ms`,
        )
      }
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

      if (profile.role !== 'ADMINISTRADOR' && profile.role !== 'RECEPCIONISTA') {
        next(
          new HttpError(
            403,
            'EMPLOYEE_ROLE_NOT_AUTHORIZED',
            'El acceso al sistema está reservado para administración y recepción.',
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
