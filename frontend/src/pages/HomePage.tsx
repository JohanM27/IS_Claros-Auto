import { Link } from 'react-router-dom'

const benefits = [
  {
    number: '01',
    title: 'Atención clara',
    description: 'Información sencilla para que sepas qué necesita tu vehículo.',
  },
  {
    number: '02',
    title: 'Cuidado responsable',
    description: 'Un enfoque pensado para acompañarte en cada visita al taller.',
  },
  {
    number: '03',
    title: 'Mantenimiento oportuno',
    description: 'Conoce opciones de servicio que ayudan a cuidar tu vehículo.',
  },
]

export function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div
          aria-hidden="true"
          className="absolute -right-40 -top-40 -z-10 size-[34rem] rounded-full border border-white/10 sm:right-0 sm:top-[-18rem]"
        >
          <div className="absolute inset-10 rounded-full border border-white/10" />
          <div className="absolute inset-24 rounded-full border border-white/10" />
          <div className="absolute inset-40 rounded-full border border-blue-400/30 bg-blue-600/10" />
        </div>
        <div className="mx-auto grid min-h-[36rem] max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
              <span aria-hidden="true" className="size-2 rounded-full bg-amber-400" />
              Taller automotriz
            </p>
            <h1 className="mt-7 text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Tu vehículo,
              <span className="block text-blue-300">en buenas manos.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              En Claros Auto trabajamos para que cuidar tu vehículo sea una experiencia clara,
              cercana y sencilla.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/servicios"
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300"
              >
                Conocer servicios
              </Link>
              <Link
                to="/citas"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 px-6 py-3 font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300"
              >
                Solicitar una cita
              </Link>
            </div>
          </div>

          <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
            <div className="aspect-square rounded-full border border-white/10 bg-gradient-to-br from-blue-500/20 via-slate-900 to-slate-950 p-8 shadow-2xl shadow-blue-950/50">
              <div className="flex size-full items-center justify-center rounded-full border border-white/10 bg-slate-950/70">
                <div className="flex size-52 items-center justify-center rounded-full border-[18px] border-slate-700 bg-slate-900 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08)] sm:size-64">
                  <div className="flex size-28 items-center justify-center rounded-full border-2 border-blue-300/70 bg-blue-500/10 sm:size-36">
                    <span className="size-4 rounded-full bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.8)]" />
                  </div>
                </div>
              </div>
            </div>
            <p className="absolute bottom-4 right-0 rounded-lg border border-white/10 bg-slate-900/90 px-4 py-3 text-sm font-semibold text-slate-200 shadow-xl sm:-right-4">
              Cuidado para seguir avanzando
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-24" aria-labelledby="about-title">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
              Sobre el taller
            </p>
            <h2 id="about-title" className="mt-4 text-4xl font-black leading-tight tracking-tight">
              Servicio pensado alrededor de ti.
            </h2>
          </div>
          <div className="max-w-3xl">
            <p className="text-lg leading-8 text-slate-600">
              Claros Auto nace con el propósito de hacer más simple la gestión del cuidado
              automotriz. Queremos ofrecer un trato cercano, explicar cada paso y ayudar a nuestros
              clientes a tomar decisiones informadas sobre su vehículo.
            </p>
            <p className="mt-5 leading-7 text-slate-600">
              Estamos construyendo una experiencia digital que reúna la información del taller y
              facilite el contacto para solicitar atención.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-100 py-20 sm:py-24" aria-labelledby="benefits-title">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
              Nuestra forma de trabajar
            </p>
            <h2 id="benefits-title" className="mt-4 text-4xl font-black tracking-tight">
              Confianza en cada visita.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article
                key={benefit.number}
                className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <p className="text-sm font-black tracking-[0.18em] text-blue-700">
                  {benefit.number}
                </p>
                <h3 className="mt-8 text-xl font-bold text-slate-950">{benefit.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-800 py-16 text-white sm:py-20" aria-labelledby="contact-title">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-200">Hablemos</p>
            <h2 id="contact-title" className="mt-4 text-4xl font-black tracking-tight">
              Estamos preparando nuestro espacio digital.
            </h2>
            <p className="mt-4 leading-7 text-blue-100">
              Pronto podrás conocer nuestros servicios y enviar una solicitud de cita desde aquí.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 p-6 sm:min-w-72">
            <p className="font-bold">Contacto del taller</p>
            <dl className="mt-4 space-y-3 text-sm text-blue-100">
              <div className="flex justify-between gap-6">
                <dt>Teléfono</dt>
                <dd>Pendiente de definir</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt>Ubicación</dt>
                <dd>Pendiente de definir</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt>Horario</dt>
                <dd>Pendiente de definir</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </>
  )
}
