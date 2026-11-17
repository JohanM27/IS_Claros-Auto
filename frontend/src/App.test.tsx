// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'

afterEach(cleanup)

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
    expect(screen.getAllByRole('article')).toHaveLength(6)
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

    await user.click(screen.getAllByRole('link', { name: 'Solicitar este servicio' })[0])

    const serviceField = screen.getByLabelText(/servicio solicitado/i) as HTMLSelectElement
    expect(serviceField.value).toBe('Cambio de aceite')
    expect(
      screen.getByRole('heading', { name: 'Cuéntanos qué necesita tu vehículo.' }),
    ).toBeTruthy()
  })
})
