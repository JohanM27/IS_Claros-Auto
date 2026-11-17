import { prisma } from '../../config/database.js'
import type { CrearCitaInput } from './cita.schema.js'

export async function crearRegistroCita(input: CrearCitaInput, lookupTokenHash: string) {
  return prisma.$transaction(async (transaction) => {
    const service = await transaction.service.findFirst({
      where: { id: input.serviceId, isActive: true },
      select: { id: true, name: true },
    })
    if (!service) return null

    const existingCustomer = await transaction.customer.findFirst({
      where: { name: input.name, phone: input.phone },
      select: { id: true, email: true },
    })
    const customer = existingCustomer
      ? input.email && input.email !== existingCustomer.email
        ? await transaction.customer.update({
            where: { id: existingCustomer.id },
            data: { email: input.email },
            select: { id: true },
          })
        : existingCustomer
      : await transaction.customer.create({
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email || null,
          },
          select: { id: true },
        })
    const existingVehicle = await transaction.vehicle.findFirst({
      where: {
        customerId: customer.id,
        make: input.vehicleMake,
        model: input.vehicleModel,
        year: input.vehicleYear,
        plate: null,
      },
      select: { id: true },
    })
    const vehicle =
      existingVehicle ??
      (await transaction.vehicle.create({
        data: {
          customerId: customer.id,
          make: input.vehicleMake,
          model: input.vehicleModel,
          year: input.vehicleYear,
        },
        select: { id: true },
      }))
    const appointment = await transaction.appointment.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        serviceId: service.id,
        requestedAt: input.requestedAt,
        notes: input.notes || null,
        status: 'PENDIENTE',
        lookupTokenHash,
      },
      select: { id: true, status: true, requestedAt: true, createdAt: true },
    })

    return { ...appointment, service }
  })
}

export async function buscarCitaPorId(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      createdAt: true,
      service: { select: { name: true } },
    },
  })
}

export async function obtenerHashTokenCita(id: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { lookupTokenHash: true },
  })
  return appointment?.lookupTokenHash ?? null
}
