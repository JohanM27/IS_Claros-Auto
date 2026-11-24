import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { ApiError, getEmployeeIdentity, type EmployeeIdentity } from '../services/api'
import { supabase } from './supabaseClient'

type AuthContextValue = {
  session: Session | null
  user: User | null
  employee: EmployeeIdentity | null
  employeeLoading: boolean
  loading: boolean
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [employee, setEmployee] = useState<EmployeeIdentity | null>(null)
  const [employeeLoading, setEmployeeLoading] = useState(Boolean(supabase))
  const identityCache = useRef(new Map<string, EmployeeIdentity>())
  const identityRequests = useRef(new Map<string, Promise<EmployeeIdentity>>())

  const loadEmployeeIdentity = useCallback((userId: string, accessToken: string) => {
    const cachedIdentity = identityCache.current.get(userId)
    if (cachedIdentity) return Promise.resolve(cachedIdentity)

    const pendingRequest = identityRequests.current.get(userId)
    if (pendingRequest) return pendingRequest

    let request: Promise<EmployeeIdentity>
    request = getEmployeeIdentity(accessToken)
      .then((identity) => {
        identityCache.current.set(userId, identity)
        return identity
      })
      .finally(() => {
        if (identityRequests.current.get(userId) === request) {
          identityRequests.current.delete(userId)
        }
      })
    identityRequests.current.set(userId, request)
    return request
  }, [])

  useEffect(() => {
    if (!supabase) return

    let active = true
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setLoading(false)
        if (!nextSession) {
          identityCache.current.clear()
          identityRequests.current.clear()
          setEmployee(null)
          setEmployeeLoading(false)
        }
      }
    })

    void supabase.auth
      .getSession()
      .then(({ data: result }) => {
        if (active) {
          setSession(result.session)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setEmployee(null)
      setEmployeeLoading(false)
      return
    }

    let active = true
    const userId = session.user.id
    const cachedIdentity = identityCache.current.get(userId)
    if (cachedIdentity) {
      setEmployee(cachedIdentity)
      setEmployeeLoading(false)
    } else {
      setEmployee(null)
      setEmployeeLoading(true)
      void loadEmployeeIdentity(userId, session.access_token)
        .then((identity) => {
          if (active) setEmployee(identity)
        })
        .catch(() => {
          if (active) setEmployee(null)
        })
        .finally(() => {
          if (active) setEmployeeLoading(false)
        })
    }

    return () => {
      active = false
    }
  }, [session?.access_token, session?.user.id, loadEmployeeIdentity])

  async function signIn(email: string, password: string) {
    if (!supabase) {
      throw new Error('El inicio de sesión todavía no está configurado.')
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      throw new Error('No se pudo iniciar sesión. Verifica el correo y la contraseña.')
    }

    const accessToken = data.session?.access_token
    if (!accessToken) {
      await supabase.auth.signOut()
      throw new Error('No se pudo verificar la cuenta del empleado.')
    }

    try {
      const identity = await loadEmployeeIdentity(data.user.id, accessToken)
      if (identity.role !== 'ADMINISTRADOR' && identity.role !== 'RECEPCIONISTA') {
        throw new ApiError('Rol sin acceso al sistema.', 403)
      }
      setEmployee(identity)
    } catch (cause) {
      await supabase.auth.signOut()
      if (cause instanceof ApiError && cause.status === 403) {
        throw new Error('El acceso está reservado para administración y recepción.')
      }
      throw cause instanceof Error
        ? cause
        : new Error('No se pudo verificar la cuenta del empleado.')
    }
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error('No se pudo cerrar la sesión. Intenta de nuevo.')
    identityCache.current.clear()
    identityRequests.current.clear()
    setEmployee(null)
    setEmployeeLoading(false)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        employee,
        employeeLoading,
        loading,
        isConfigured: Boolean(supabase),
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
