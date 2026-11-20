import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { PageMetadata } from '../components/PageMetadata'

export function LoginPage() {
  const { signIn, isConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const returnTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/admin'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isConfigured) {
      setError('El inicio de sesión no está configurado. Contacta al administrador del sistema.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await signIn(email, password)
      navigate(returnTo, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12">
      <PageMetadata
        title="Acceso de empleados"
        description="Inicio de sesión privado para el personal de Claros Auto."
        indexable={false}
      />
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
        <Link to="/" className="text-lg font-black tracking-tight text-slate-950">
          Claros <span className="text-blue-700">Auto</span>
        </Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
          Acceso del taller
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Iniciar sesión</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ingresa con la cuenta de empleado asignada por el administrador.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          >
            {error}
          </p>
        )}

        {!isConfigured && !error && (
          <p
            role="status"
            className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          >
            El inicio de sesión requiere configurar las variables públicas de Supabase.
          </p>
        )}

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-950 shadow-sm outline-none focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-700/30"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-12 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-950 shadow-sm outline-none focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-700/30"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !isConfigured}
            className="min-h-12 w-full rounded-md bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <Link
          to="/"
          className="mt-6 inline-block text-sm font-semibold text-blue-800 underline underline-offset-4"
        >
          Volver al sitio público
        </Link>
      </section>
    </main>
  )
}
