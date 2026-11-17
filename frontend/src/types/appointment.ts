export type AppointmentFormValues = {
  fullName: string
  phone: string
  email: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string
  service: string
  preferredDate: string
  preferredTime: string
  notes: string
}

export type AppointmentField = keyof AppointmentFormValues
export type AppointmentErrors = Partial<Record<AppointmentField, string>>
