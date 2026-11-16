import { Link } from 'react-router-dom'
import type { Service } from '../types/service'

type ServiceCardProps = {
  service: Service
}

export function ServiceCard({ service }: ServiceCardProps) {
  const appointmentUrl = `/citas?servicio=${encodeURIComponent(service.name)}`

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-7">
      <div
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-lg bg-blue-50 text-lg font-black text-blue-800"
      >
        {service.name.slice(0, 1)}
      </div>
      <h2 className="mt-6 text-xl font-bold text-slate-950">{service.name}</h2>
      <p className="mt-3 flex-1 leading-7 text-slate-600">{service.description}</p>
      <Link
        to={appointmentUrl}
        className="mt-6 inline-flex w-fit items-center rounded-sm font-bold text-blue-800 underline decoration-blue-300 underline-offset-4 transition-colors hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
      >
        Solicitar este servicio
      </Link>
    </article>
  )
}
