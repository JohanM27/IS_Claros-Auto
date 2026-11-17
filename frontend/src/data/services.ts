import type { Service } from '../types/service'

export const services: Service[] = [
  {
    id: 'cambio-aceite',
    name: 'Cambio de aceite',
    description: 'Servicio de aceite y filtro según las necesidades de tu vehículo.',
  },
  {
    id: 'diagnostico-automotriz',
    name: 'Diagnóstico automotriz',
    description: 'Revisión para identificar señales y posibles causas de una falla.',
  },
  {
    id: 'reparacion-frenos',
    name: 'Reparación de frenos',
    description: 'Inspección y atención del sistema de frenos de tu vehículo.',
  },
  {
    id: 'mantenimiento-preventivo',
    name: 'Mantenimiento preventivo',
    description: 'Revisión periódica enfocada en el cuidado general del vehículo.',
  },
  {
    id: 'suspension',
    name: 'Suspensión',
    description: 'Evaluación de los componentes de suspensión y dirección.',
  },
  {
    id: 'revision-general',
    name: 'Revisión general',
    description: 'Inspección general para conocer el estado de distintos sistemas.',
  },
]
