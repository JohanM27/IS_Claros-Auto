import { Link } from 'react-router-dom'
import { AppointmentForm } from '../components/AppointmentForm'
import { PageHeading } from '../components/PageHeading'
import { PageMetadata } from '../components/PageMetadata'

export function AppointmentsPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
      <PageMetadata
        title="Solicitar cita"
        description="Envía a Claros Auto tu fecha preferida y los datos necesarios para que el taller revise tu solicitud de cita."
        indexable={false}
      />
      <div>
        <PageHeading
          eyebrow="Solicitud de atención"
          title="Cuéntanos qué necesita tu vehículo."
          description="Comparte tus datos y una fecha preferida. El taller revisará la solicitud y confirmará la disponibilidad."
        />
        <Link
          to="/servicios"
          className="mt-8 inline-flex rounded-sm font-bold text-blue-800 underline decoration-blue-300 underline-offset-4 hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          Revisar el catálogo de servicios
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <AppointmentForm />
      </div>
    </div>
  )
}
