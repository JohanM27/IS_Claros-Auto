import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8" aria-labelledby="not-found-title">
      <h1 id="not-found-title" className="text-4xl font-black tracking-tight">
        Página no encontrada
      </h1>
      <Link
        to="/"
        className="mt-8 inline-flex rounded-md bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Volver al inicio
      </Link>
    </section>
  )
}
