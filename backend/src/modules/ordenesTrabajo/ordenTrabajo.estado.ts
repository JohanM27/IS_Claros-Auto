import type { WorkOrderStatus } from '../../generated/prisma/client.js'
import { HttpError } from '../../utils/httpError.js'

export const transicionesEstadoOrden: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  ABIERTA: ['EN_DIAGNOSTICO', 'CANCELADA'],
  EN_DIAGNOSTICO: ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['FINALIZADA', 'CANCELADA'],
  FINALIZADA: [],
  CANCELADA: [],
}

export function validarTransicionEstadoOrden(
  estadoActual: WorkOrderStatus,
  estadoNuevo: WorkOrderStatus,
  observaciones: string | null,
) {
  if (estadoActual === estadoNuevo) {
    throw new HttpError(409, 'WORK_ORDER_STATE_UNCHANGED', 'La orden ya tiene ese estado.')
  }

  if (!transicionesEstadoOrden[estadoActual].includes(estadoNuevo)) {
    throw new HttpError(
      409,
      'WORK_ORDER_TRANSITION_NOT_ALLOWED',
      'La orden no puede cambiar desde su estado actual al estado solicitado.',
    )
  }

  if (estadoNuevo === 'CANCELADA' && !observaciones?.trim()) {
    throw new HttpError(
      400,
      'WORK_ORDER_CANCELLATION_REASON_REQUIRED',
      'Escribe el motivo para cancelar la orden.',
    )
  }
}
