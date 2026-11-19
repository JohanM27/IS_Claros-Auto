import type { RequestHandler } from 'express'
import type { ServicioPublico } from './servicio.types.js'

type ListarServicios = () => Promise<ServicioPublico[]>

export function crearControladorServicios(listar: ListarServicios): RequestHandler {
  return async (_request, response) => {
    const servicios = await listar()
    response.status(200).json({ data: servicios })
  }
}
