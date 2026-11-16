import { Link } from 'react-router-dom'

export function ServicesPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8" aria-labelledby="services-title">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">Claros Auto</p>
      <h1 id="services-title" className="mt-3 text-4xl font-black tracking-tight">
        Nuestros servicios
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">
        El catálogo de servicios se publicará próximamente.
      </p>
      <Link
        to="/citas"
        className="mt-8 inline-flex rounded-md bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Solicitar una cita
      </Link>
    </section>
  )
}
