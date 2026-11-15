type PageHeadingProps = {
  eyebrow: string
  title: string
  description: string
}

export function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  return (
    <header className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
        {eyebrow}
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      <p className="max-w-2xl text-lg leading-8 text-slate-600">{description}</p>
    </header>
  )
}
