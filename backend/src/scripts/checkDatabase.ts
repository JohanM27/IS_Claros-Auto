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
    console.info('Database connection successful.')
  } catch {
    console.error('Database connection failed. Check DATABASE_URL and database availability.')
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void checkDatabase()
