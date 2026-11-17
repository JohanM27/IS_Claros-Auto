/**
 * Implementación intencionalmente defectuosa para la clínica de código.
 * No usar en producción.
 */
export function calculateEstimate({
  laborHours,
  hourlyRate,
  partsCost,
  discountPercent,
  taxPercent,
}) {
  let total = laborHours * hourlyRate + partsCost
  total -= (total * discountPercent) / 100
  total += (total * taxPercent) / 100

  return total
}
