import { prisma } from '../../config/database.js'

export function listarOrdenesTrabajo() {
  return prisma.workOrder.findMany({
    orderBy: [{ fechaIngreso: 'desc' }, { fechaCreacion: 'desc' }],
    select: {
      id: true,
      numeroOrden: true,
      clienteId: true,
      vehiculoId: true,
      citaId: true,
      descripcionProblema: true,
      observaciones: true,
      mecanicoResponsable: true,
      estado: true,
      fechaIngreso: true,
      fechaCreacion: true,
      fechaActualizacion: true,
      cliente: { select: { name: true, phone: true } },
      vehiculo: { select: { make: true, model: true, year: true, plate: true } },
    },
  })
}
