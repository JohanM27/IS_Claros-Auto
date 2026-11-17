export type CitaRegistrada = {
  id: string
  status: 'PENDIENTE'
  requestedAt: string
  createdAt: string
  service: { id: string; name: string }
  lookupToken: string
}

export type CitaConsultable = {
  id: string
  status: string
  requestedAt: string
  createdAt: string
  service: { name: string }
}
