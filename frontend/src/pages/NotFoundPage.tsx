import { Link } from 'react-router-dom'
import { PageMetadata } from '../components/PageMetadata'

export function NotFoundPage() {
  return (
    <>
      <PageMetadata
        title="Página no encontrada"
        description="La página que buscas no está disponible en Claros Auto."
        indexable={false}
      />
      <section
        className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-start justify-center px-5 py-20 sm:px-8"
        aria-labelledby="not-found-title"
        aria-describedby="not-found-description"
      >
        <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">Error 404</p>
        <h1 id="not-found-title" className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          No encontramos esa página
        </h1>
        <p id="not-found-description" className="mt-4 max-w-xl text-lg leading-7 text-slate-600">
          Puede que el enlace haya cambiado o que la dirección esté escrita incorrectamente.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-md bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Volver al inicio
          </Link>
          <Link
            to="/servicios"
            className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-5 py-3 font-bold text-slate-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Ver servicios
          </Link>
        </div>
      </section>
    </>
  )
}
