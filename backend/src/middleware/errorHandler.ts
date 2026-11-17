import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../utils/httpError.js'

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    })
    return
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'La solicitud contiene campos inválidos.',
        details: { fieldErrors: error.flatten().fieldErrors },
      },
    })
    return
  }

  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status?: unknown }).status)
    const type = 'type' in error ? (error as { type?: unknown }).type : undefined
    if (status === 400 && type === 'entity.parse.failed') {
      response.status(400).json({
        error: { code: 'INVALID_JSON', message: 'El cuerpo de la solicitud no es JSON válido.' },
      })
      return
    }
    if (status === 413) {
      response.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'La solicitud es demasiado grande.' },
      })
      return
    }
  }

  console.error('API request failed.')
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' },
  })
}
