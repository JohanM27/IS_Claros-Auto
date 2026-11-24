// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../services/api'
import { AuthProvider, useAuth } from './AuthContext'

const mocks = vi.hoisted(() => ({
  getEmployeeIdentity: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: mocks.unsubscribe } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  },
}))

vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message)
    }
  },
  getEmployeeIdentity: mocks.getEmployeeIdentity,
}))

function SignInProbe() {
  const { signIn } = useAuth()
  const [message, setMessage] = useState('')
  return (
    <>
      <button
        onClick={() => {
          void signIn('mecanico@example.com', 'password').catch((error: Error) =>
            setMessage(error.message),
          )
        }}
      >
        Ingresar
      </button>
      {message && <p role="alert">{message}</p>}
    </>
  )
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.signInWithPassword.mockResolvedValue({
    data: { user: { id: 'employee-1' }, session: { access_token: 'access-token' } },
    error: null,
  })
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.getEmployeeIdentity.mockRejectedValue(
    new ApiError('El acceso está reservado para administración y recepción.', 403),
  )
})

describe('inicio de sesión de empleados', () => {
  it('cierra la sesión si la cuenta no tiene rol de administración o recepción', async () => {
    render(
      <AuthProvider>
        <SignInProbe />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'El acceso está reservado para administración y recepción.',
    )
    expect(mocks.getEmployeeIdentity).toHaveBeenCalledWith('access-token')
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
})
