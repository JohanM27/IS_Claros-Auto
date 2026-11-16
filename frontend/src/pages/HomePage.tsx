import { PageHeading } from '../components/PageHeading'
import { apiBaseUrl } from '../services/api'

export function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
      <PageHeading
        eyebrow="Taller automotriz · Honduras"
        title="Claros Auto"
        description="Base técnica del sistema de administración del taller. La página pública y los módulos administrativos se incorporarán en avances posteriores."
      />
      <p className="w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
        API configurada en <code className="font-mono text-slate-900">{apiBaseUrl}</code>
      </p>
    </div>
  )
}
