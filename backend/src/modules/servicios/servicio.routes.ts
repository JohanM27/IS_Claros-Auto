import { Router } from 'express'
import { crearControladorServicios } from './servicio.controller.js'
import { obtenerServiciosPublicos } from './servicio.service.js'
import type { ServicioPublico } from './servicio.types.js'

type ListarServicios = () => Promise<ServicioPublico[]>

export function crearRutasServicios(listar: ListarServicios = obtenerServiciosPublicos) {
  const router = Router()
  router.get('/', crearControladorServicios(listar))
  return router
}
