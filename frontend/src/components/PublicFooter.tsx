import { Link } from 'react-router-dom'

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8">
        <div>
          <p className="font-bold text-white">Claros Auto</p>
          <p className="mt-2 text-sm">Servicio automotriz con atención cercana y profesional.</p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm">Información de contacto por definir.</p>
          <Link
            to="/citas"
            className="mt-3 inline-block rounded-sm text-sm font-semibold text-white underline decoration-blue-400 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
          >
            Solicitar una cita
          </Link>
        </div>
      </div>
    </footer>
  )
}
