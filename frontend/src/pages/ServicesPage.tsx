import { useEffect, useState } from 'react'
import { ServiceCard } from '../components/ServiceCard'
import { PageHeading } from '../components/PageHeading'
import { getServices } from '../services/api'
import type { Service } from '../types/service'
import { PageMetadata } from '../components/PageMetadata'

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getServices()
      .then((items) => {
        if (active) setServices(items)
      })
      .catch(() => {
        if (active) setError('No se pudo cargar el catálogo. Intenta recargar la página.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
      <PageMetadata
        title="Servicios"
        description="Consulta los servicios de Claros Auto para tu vehículo y envía una solicitud de atención al taller."
      />
      <PageHeading
        eyebrow="Claros Auto"
        title="Servicios para tu vehículo"
        description="Conoce algunas opciones de atención automotriz. La disponibilidad y los detalles se confirmarán con el taller."
      />
      {loading && (
        <p role="status" className="mt-12 text-slate-600">
          Cargando servicios…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-12 rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}
      {!loading && !error && services.length === 0 && (
        <p className="mt-12 text-slate-600">No hay servicios disponibles en este momento.</p>
      )}
      {!loading && !error && services.length > 0 && (
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  )
}
