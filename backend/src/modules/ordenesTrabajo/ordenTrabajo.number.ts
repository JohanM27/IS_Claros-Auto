export function formatearNumeroOrden(sequence: bigint) {
  return `OT-${String(sequence).padStart(6, '0')}`
}
