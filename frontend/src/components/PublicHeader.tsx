import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const navigation = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/servicios', label: 'Servicios', end: false },
]

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
    isActive ? 'text-blue-800' : 'text-slate-600 hover:text-blue-800'
  }`

export function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link
          to="/"
          className="rounded-sm text-xl font-black tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          onClick={closeMenu}
        >
          Claros <span className="text-blue-700">Auto</span>
        </Link>

        <nav aria-label="Navegación principal" className="hidden items-center gap-2 md:flex">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClassName}>
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/citas"
            className="ml-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Solicitar cita
          </NavLink>
        </nav>

        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 md:hidden"
        >
          {isMenuOpen ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      <nav
        id="mobile-navigation"
        aria-label="Navegación móvil"
        hidden={!isMenuOpen}
        className="flex flex-col gap-1 border-t border-slate-200 px-5 py-3 md:hidden"
      >
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={linkClassName}
            onClick={closeMenu}
          >
            {item.label}
          </NavLink>
        ))}
        <NavLink
          to="/citas"
          className="rounded-md bg-blue-700 px-3 py-2.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          onClick={closeMenu}
        >
          Solicitar cita
        </NavLink>
      </nav>
    </header>
  )
}
