import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma/client.js'

type PrismaGlobal = typeof globalThis & {
  clarosAutoPrisma?: PrismaClient
}

const prismaGlobal = globalThis as PrismaGlobal
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://USER:PASSWORD@127.0.0.1:5432/claros_auto?schema=public',
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
  max: 10,
})
const adapter = new PrismaPg(pool)

export const prisma =
  prismaGlobal.clarosAutoPrisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.clarosAutoPrisma = prisma
}
