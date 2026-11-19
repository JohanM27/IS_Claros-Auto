import { prisma } from '../../config/database.js'

export async function listarServiciosActivos() {
  return prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true, description: true },
  })
}
