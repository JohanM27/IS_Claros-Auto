import { listarServiciosActivos } from './servicio.repository.js'

export function obtenerServiciosPublicos() {
  return listarServiciosActivos()
}
