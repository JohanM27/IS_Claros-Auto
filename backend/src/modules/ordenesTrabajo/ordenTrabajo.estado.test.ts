import { describe, expect, it } from 'vitest'
import { HttpError } from '../../utils/httpError.js'
import { validarTransicionEstadoOrden } from './ordenTrabajo.estado.js'

describe('transiciones de estado de órdenes de trabajo', () => {
  it.each([
    ['ABIERTA', 'EN_DIAGNOSTICO'],
    ['EN_DIAGNOSTICO', 'EN_PROCESO'],
    ['EN_PROCESO', 'FINALIZADA'],
  ] as const)('permite avanzar de %s a %s', (current, next) => {
    expect(() => validarTransicionEstadoOrden(current, next, null)).not.toThrow()
  })

  it.each(['ABIERTA', 'EN_DIAGNOSTICO', 'EN_PROCESO'] as const)(
    'permite cancelar %s solo con motivo',
    (current) => {
      expect(() =>
        validarTransicionEstadoOrden(current, 'CANCELADA', 'Cliente canceló'),
      ).not.toThrow()
      expect(() => validarTransicionEstadoOrden(current, 'CANCELADA', '  ')).toThrow(HttpError)
    },
  )

  it.each([
    ['ABIERTA', 'EN_PROCESO'],
    ['EN_DIAGNOSTICO', 'FINALIZADA'],
    ['EN_PROCESO', 'ABIERTA'],
    ['FINALIZADA', 'EN_PROCESO'],
    ['CANCELADA', 'ABIERTA'],
    ['ABIERTA', 'ABIERTA'],
  ] as const)('rechaza la transición %s → %s', (current, next) => {
    expect(() => validarTransicionEstadoOrden(current, next, 'Motivo')).toThrow(HttpError)
  })
})
