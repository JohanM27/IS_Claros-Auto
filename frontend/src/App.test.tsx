// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const { getServices } = vi.hoisted(() => ({ getServices: vi.fn() }))

vi.mock('./services/api', () => ({
  getServices,
  createAppointment: vi.fn(),
}))

afterEach(cleanup)
beforeEach(() => {
  getServices.mockResolvedValue([
    { id: 'svc-1', slug: 'cambio-aceite', name: 'Cambio de aceite', description: 'Servicio' },
    {
      id: 'svc-2',
      slug: 'diagnostico-automotriz',
      name: 'Diagnóstico automotriz',
      description: 'Servicio',
    },
    {
      id: 'svc-3',
      slug: 'reparacion-frenos',
      name: 'Reparación de frenos',
      description: 'Servicio',
    },
    {
      id: 'svc-4',
      slug: 'mantenimiento-preventivo',
      name: 'Mantenimiento preventivo',
      description: 'Servicio',
    },
    { id: 'svc-5', slug: 'suspension', name: 'Suspensión', description: 'Servicio' },
    { id: 'svc-6', slug: 'revision-general', name: 'Revisión general', description: 'Servicio' },
  ])
})

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('rutas públicas', () => {
  it('muestra la página principal y navega al catálogo', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Tu vehículo,')
    await user.click(
      within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', {
        name: 'Servicios',
      }),
    )

    expect(screen.getByRole('heading', { name: 'Servicios para tu vehículo' })).toBeTruthy()
    expect(await screen.findAllByRole('article')).toHaveLength(6)
  })

  it('abre el menú y navega con teclado', async () => {
    const user = userEvent.setup()
    renderApp()
    const menuButton = screen.getByRole('button', { name: 'Abrir menú' })

    menuButton.focus()
    await user.keyboard('{Enter}')
    expect(menuButton.getAttribute('aria-expanded')).toBe('true')

    const servicesLink = within(
      screen.getByRole('navigation', { name: 'Navegación móvil' }),
    ).getByRole('link', { name: 'Servicios' })
    servicesLink.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('heading', { name: 'Servicios para tu vehículo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir menú' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
  })

  it('permite llegar al enlace para saltar contenido con el teclado', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.tab()

    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Saltar al contenido' }))
  })

  it('preselecciona el servicio desde el catálogo en el formulario', async () => {
    const user = userEvent.setup()
    renderApp('/servicios')

    await user.click((await screen.findAllByRole('link', { name: 'Solicitar este servicio' }))[0])

    const serviceField = screen.getByLabelText(/servicio solicitado/i) as HTMLSelectElement
    await vi.waitFor(() => expect(serviceField.value).toBe('svc-1'))
    expect(
      screen.getByRole('heading', { name: 'Cuéntanos qué necesita tu vehículo.' }),
    ).toBeTruthy()
  })
})
