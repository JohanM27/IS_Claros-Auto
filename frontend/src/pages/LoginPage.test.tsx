// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const { signIn, config } = vi.hoisted(() => ({
  signIn: vi.fn(),
  config: { isConfigured: true },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ signIn, isConfigured: config.isConfigured }),
}))

afterEach(cleanup)

beforeEach(() => {
  signIn.mockReset().mockResolvedValue(undefined)
  config.isConfigured = true
})

function CurrentPath() {
  const location = useLocation()
  return <p>Ruta actual: {location.pathname}</p>
}

function renderLogin(
  initialEntries: NonNullable<Parameters<typeof MemoryRouter>[0]['initialEntries']> = ['/login'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<p>Panel administrativo</p>} />
        <Route path="/citas" element={<p>Ruta solicitada antes del login</p>} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('inicio de sesión de empleados', () => {
  it('envía correo y contraseña al proveedor de autenticación', async () => {
    renderLogin()

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'recepcion@clarosauto.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password-local' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('recepcion@clarosauto.com', 'password-local'),
    )
  })

  it('redirige al panel administrativo después de un login válido', async () => {
    renderLogin()

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'recepcion@clarosauto.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password-local' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Panel administrativo')).toBeTruthy()
  })

  it('conserva la ruta privada original cuando se solicitó antes del login', async () => {
    renderLogin([{ pathname: '/login', state: { from: { pathname: '/citas' } } }])

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'recepcion@clarosauto.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password-local' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Ruta solicitada antes del login')).toBeTruthy()
  })

  it('muestra un error genérico si falla la autenticación', async () => {
    signIn.mockRejectedValue(
      new Error('No se pudo iniciar sesión. Verifica el correo y la contraseña.'),
    )
    renderLogin()

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'empleado@clarosauto.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo iniciar sesión')
  })

  it('no ofrece registro público de empleados', () => {
    renderLogin()

    expect(screen.queryByRole('link', { name: /registr/i })).toBeNull()
    expect(screen.getByText(/cuenta de empleado asignada/i)).toBeTruthy()
  })
})
