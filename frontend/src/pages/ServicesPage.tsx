import { ServiceCard } from '../components/ServiceCard'
import { services } from '../data/services'
import { PageHeading } from '../components/PageHeading'

export function ServicesPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
      <PageHeading
        eyebrow="Claros Auto"
        title="Servicios para tu vehículo"
        description="Conoce algunas opciones de atención automotriz. La disponibilidad y los detalles se confirmarán con el taller."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </div>
  )
}
