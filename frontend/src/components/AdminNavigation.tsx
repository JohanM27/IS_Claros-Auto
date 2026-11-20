import { Link, NavLink } from 'react-router-dom'
import type { EmployeeIdentity } from '../services/api'

type AdminNavigationProps = {
  title: string
  employee: EmployeeIdentity | null
  onSignOut: () => void
}

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-semibold ${
    isActive ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'
  }`

export function AdminNavigation({ title, employee, onSignOut }: AdminNavigationProps) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-blue-700">Claros Auto</p>
        <h1 className="mt-1 text-3xl font-black">{title}</h1>
        {employee && (
          <p className="mt-1 text-slate-600">
            {employee.displayName ?? employee.email} · {employee.role}
          </p>
        )}
      </div>
      <nav aria-label="Navegación administrativa" className="flex flex-wrap items-center gap-1">
        <NavLink to="/admin" end className={linkClassName}>
          Citas
        </NavLink>
        <NavLink to="/admin/ordenes" className={linkClassName}>
          Órdenes de trabajo
        </NavLink>
        <Link className="ml-2 rounded-md border border-slate-300 px-4 py-2 font-semibold" to="/">
          Ver sitio
        </Link>
        <button
          className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white"
          onClick={onSignOut}
        >
          Cerrar sesión
        </button>
      </nav>
    </header>
  )
}
