// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { InventoryCategoriesPage } from './InventoryCategoriesPage'

const mocks = vi.hoisted(() => ({
  session: { access_token: 'access-token' } as { access_token: string } | null,
  employee: {
    id: 'employee-1',
    email: 'admin@example.com',
    role: 'ADMINISTRADOR',
    displayName: 'Johan',
  } as { id: string; email: string; role: string; displayName: string } | null,
  loading: false,
  employeeLoading: false,
  signOut: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setActive: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    session: mocks.session,
    employee: mocks.employee,
    loading: mocks.loading,
    employeeLoading: mocks.employeeLoading,
    signOut: mocks.signOut,
  }),
}))

vi.mock('../services/api', () => ({
  createInventoryCategory: mocks.create,
  getInventoryCategories: mocks.list,
  setInventoryCategoryActive: mocks.setActive,
  updateInventoryCategory: mocks.update,
}))

const category = {
  id: '73d1c6fd-4f57-46bb-a807-eac572482125',
  nombre: 'Filtros',
  descripcion: 'Filtros de aceite y aire',
  activo: true,
  fechaCreacion: '2026-11-24T12:00:00.000Z',
  fechaActualizacion: '2026-11-24T12:00:00.000Z',
  _count: { repuestos: 3 },
}

function page(data = [category], totalPages = 1) {
  return {
    data,
    pagination: { page: 1, pageSize: 10, total: data.length, totalPages },
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/inventario/categorias']}>
      <InventoryCategoriesPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = { access_token: 'access-token' }
  mocks.employee = {
    id: 'employee-1',
    email: 'admin@example.com',
    role: 'ADMINISTRADOR',
    displayName: 'Johan',
  }
  mocks.loading = false
  mocks.employeeLoading = false
  mocks.list.mockResolvedValue(page())
  mocks.create.mockResolvedValue(category)
  mocks.update.mockResolvedValue(category)
  mocks.setActive.mockResolvedValue({ ...category, activo: false })
})

describe('página de categorías de repuestos', () => {
  it('muestra categorías, cantidad de repuestos, estado y fecha', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Categorías de repuestos' })).toBeTruthy()
    expect(screen.getByText('Filtros')).toBeTruthy()
    expect(screen.getByText('Filtros de aceite y aire')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Activa')).toBeTruthy()
    expect(mocks.list).toHaveBeenCalledWith('access-token', {
      q: undefined,
      estado: 'TODAS',
      page: 1,
      pageSize: 10,
    })
  })

  it('registra una categoría desde el formulario y confirma el guardado', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Nueva categoría' }))
    await user.type(screen.getByLabelText('Nombre *'), ' Lubricantes ')
    await user.type(screen.getByLabelText('Descripción (opcional)'), 'Aceites y fluidos')
    await user.click(screen.getByRole('button', { name: 'Crear categoría' }))

    expect(await screen.findByText('La categoría se creó correctamente.')).toBeTruthy()
    expect(mocks.create).toHaveBeenCalledWith('access-token', {
      nombre: 'Lubricantes',
      descripcion: 'Aceites y fluidos',
    })
    expect(mocks.list).toHaveBeenCalledTimes(2)
  })

  it('edita nombre y descripción conservando el ID recibido del servidor', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    const name = screen.getByLabelText('Nombre *')
    await user.clear(name)
    await user.type(name, 'Filtros de motor')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('La categoría se actualizó correctamente.')).toBeTruthy()
    expect(mocks.update).toHaveBeenCalledWith('access-token', category.id, {
      nombre: 'Filtros de motor',
      descripcion: category.descripcion,
    })
  })

  it('aplica búsqueda y filtro de estado desde el backend', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Filtros')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), 'filtro')
    await user.selectOptions(screen.getByLabelText('Estado'), 'INACTIVAS')

    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith('access-token', {
        q: 'filtro',
        estado: 'INACTIVAS',
        page: 1,
        pageSize: 10,
      })
    })
  })

  it('cambia de página usando la paginación que devuelve el backend', async () => {
    const user = userEvent.setup()
    mocks.list
      .mockResolvedValueOnce({
        data: [category],
        pagination: { page: 1, pageSize: 10, total: 11, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
      })
    renderPage()
    await screen.findByText('Filtros')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith('access-token', {
        q: undefined,
        estado: 'TODAS',
        page: 2,
        pageSize: 10,
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('navigation', { name: 'Paginación de categorías' }).textContent,
      ).toContain('Página 2 de 2')
    })
  })

  it('solo permite lectura de categorías activas a recepción', async () => {
    mocks.employee = { ...mocks.employee!, role: 'RECEPCIONISTA' }
    renderPage()

    expect(await screen.findByText('Filtros')).toBeTruthy()
    expect(screen.getByText('Mostrando solo categorías activas.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nueva categoría' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(mocks.list).toHaveBeenCalledWith('access-token', {
      q: undefined,
      estado: 'ACTIVAS',
      page: 1,
      pageSize: 10,
    })
  })

  it('solicita confirmación y muestra errores al desactivar categorías con repuestos', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocks.setActive.mockRejectedValue(new Error('No se puede desactivar: hay repuestos activos.'))
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Desactivar' }))

    expect(window.confirm).toHaveBeenCalled()
    expect(mocks.setActive).toHaveBeenCalledWith('access-token', category.id, false)
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'No se puede desactivar: hay repuestos activos.',
    )
  })

  it('reactiva categorías inactivas tras confirmar', async () => {
    const user = userEvent.setup()
    const inactive = { ...category, activo: false }
    mocks.list.mockResolvedValue(page([inactive]))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Reactivar' }))

    expect(mocks.setActive).toHaveBeenCalledWith('access-token', category.id, true)
    expect(await screen.findByText('La categoría se reactivó correctamente.')).toBeTruthy()
  })

  it('muestra el estado vacío y bloquea mecánicos', async () => {
    mocks.list.mockResolvedValue(page([]))
    const { rerender } = renderPage()
    expect(await screen.findByText('Todavía no hay categorías registradas.')).toBeTruthy()

    mocks.employee = { ...mocks.employee!, role: 'MECANICO' }
    rerender(
      <MemoryRouter initialEntries={['/admin/inventario/categorias']}>
        <InventoryCategoriesPage />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
