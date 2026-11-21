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
        AND table_name IN ('Appointment', 'Customer', 'Service', 'Vehicle', 'StaffProfile', 'WorkOrder')
    `
    const presentTables = new Set(tables.map(({ table_name }) => table_name))
    const requiredTables = [
      'Appointment',
      'Customer',
      'Service',
      'Vehicle',
      'StaffProfile',
      'WorkOrder',
    ]
    const missingTables = requiredTables.filter((table) => !presentTables.has(table))

    if (missingTables.length > 0) {
      throw new Error(`Required tables are missing: ${missingTables.join(', ')}`)
    }

    const [staffProfileSecurity] = await prisma.$queryRaw<Array<{ row_level_security: boolean }>>`
      SELECT relrowsecurity AS row_level_security
      FROM pg_class
      WHERE oid = 'public."StaffProfile"'::regclass
    `
    if (!staffProfileSecurity?.row_level_security) {
      throw new Error('Row-level security is not enabled for StaffProfile.')
    }

    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM public."_prisma_migrations"
      WHERE migration_name IN (
        '20261116000000_modelo_taller',
        '20261119000000_roles_empleados',
        '20261119200000_ordenes_trabajo',
        '20261120100000_registro_ordenes_trabajo'
      )
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `

    const appliedMigrations = new Set(migrations.map(({ migration_name }) => migration_name))
    const requiredMigrations = [
      '20261116000000_modelo_taller',
      '20261119000000_roles_empleados',
      '20261119200000_ordenes_trabajo',
      '20261120100000_registro_ordenes_trabajo',
    ]
    const missingMigrations = requiredMigrations.filter(
      (migration) => !appliedMigrations.has(migration),
    )

    if (missingMigrations.length > 0) {
      throw new Error(
        `Required migrations are not recorded as applied: ${missingMigrations.join(', ')}`,
      )
    }

    console.info('Supabase connection, schema, and required migrations verified.')
  } catch {
    console.error('Database connection failed. Check DATABASE_URL and database availability.')
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void checkDatabase()
