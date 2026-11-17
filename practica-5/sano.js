const requiredFields = ['laborHours', 'hourlyRate', 'partsCost', 'discountPercent', 'taxPercent']

function validateEstimateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('El presupuesto debe ser un objeto.')
  }

  for (const field of requiredFields) {
    if (typeof input[field] !== 'number' || !Number.isFinite(input[field])) {
      throw new TypeError(`${field} debe ser un número finito.`)
    }
    if (input[field] < 0) {
      throw new RangeError(`${field} no puede ser negativo.`)
    }
  }

  if (input.discountPercent > 100) {
    throw new RangeError('discountPercent debe estar entre 0 y 100.')
  }
  if (input.taxPercent > 100) {
    throw new RangeError('taxPercent debe estar entre 0 y 100.')
  }
}

/** Calcula el total de un presupuesto y lo redondea a dos decimales. */
export function calculateEstimate(input) {
  validateEstimateInput(input)

  const laborCost = input.laborHours * input.hourlyRate
  const subtotal = laborCost + input.partsCost
  const discountedSubtotal = subtotal * (1 - input.discountPercent / 100)
  const total = discountedSubtotal * (1 + input.taxPercent / 100)

  return Math.round((total + Number.EPSILON) * 100) / 100
}
