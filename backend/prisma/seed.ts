import { prisma } from '../src/config/database.js'

const services = [
  {
    slug: 'cambio-aceite',
    name: 'Cambio de aceite',
    description: 'Servicio de aceite y filtro según las necesidades de tu vehículo.',
  },
  {
    slug: 'diagnostico-automotriz',
    name: 'Diagnóstico automotriz',
    description: 'Revisión para identificar señales y posibles causas de una falla.',
  },
  {
    slug: 'reparacion-frenos',
    name: 'Reparación de frenos',
    description: 'Inspección y atención del sistema de frenos de tu vehículo.',
  },
  {
    slug: 'mantenimiento-preventivo',
    name: 'Mantenimiento preventivo',
    description: 'Revisión periódica enfocada en el cuidado general del vehículo.',
  },
  {
    slug: 'suspension',
    name: 'Suspensión',
    description: 'Evaluación de los componentes de suspensión y dirección.',
  },
  {
    slug: 'revision-general',
    name: 'Revisión general',
    description: 'Inspección general para conocer el estado de distintos sistemas.',
  },
]

try {
  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: { name: service.name, description: service.description, isActive: true },
      create: service,
    })
  }
} finally {
  await prisma.$disconnect()
}
