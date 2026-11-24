import { prisma } from '../../config/database.js'

export function formatSku(sequence: bigint) {
  if (sequence < 1n) throw new RangeError('La secuencia SKU debe ser positiva.')
  return `REP-${sequence.toString().padStart(5, '0')}`
}

export async function generarSkuRepuesto() {
  const [row] = await prisma.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('"RepuestoSku_seq"') AS value
  `
  if (!row) throw new Error('No se pudo generar el SKU del repuesto.')
  return formatSku(row.value)
}
