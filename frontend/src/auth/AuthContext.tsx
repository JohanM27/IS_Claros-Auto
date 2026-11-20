import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { ApiError, getEmployeeIdentity } from '../services/api'
import { supabase } from './supabaseClient'

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return

    let active = true
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setLoading(false)
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
      const employee = await getEmployeeIdentity(accessToken)
      if (employee.role !== 'ADMINISTRADOR' && employee.role !== 'RECEPCIONISTA') {
        throw new ApiError('Rol sin acceso al sistema.', 403)
      }
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
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
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
