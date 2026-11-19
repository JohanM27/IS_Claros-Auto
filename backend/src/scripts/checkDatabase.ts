import 'dotenv/config'
import { prisma } from '../config/database.js'

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('Database connection failed. DATABASE_URL is not configured.')
    process.exitCode = 1
    return
  }

  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1`
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN ('Appointment', 'Customer', 'Service', 'Vehicle')
    `
    const presentTables = new Set(tables.map(({ table_name }) => table_name))
    const requiredTables = ['Appointment', 'Customer', 'Service', 'Vehicle']
    const missingTables = requiredTables.filter((table) => !presentTables.has(table))

    if (missingTables.length > 0) {
      throw new Error(`Required tables are missing: ${missingTables.join(', ')}`)
    }

    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM public."_prisma_migrations"
      WHERE migration_name = '20261116000000_modelo_taller'
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `

    if (migrations.length === 0) {
      throw new Error('The initial Claros Auto migration is not recorded as applied.')
    }

    console.info('Supabase connection, schema, and initial migration verified.')
  } catch {
    console.error('Database connection failed. Check DATABASE_URL and database availability.')
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void checkDatabase()
