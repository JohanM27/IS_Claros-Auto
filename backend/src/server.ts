import 'dotenv/config'
import { app } from './app.js'
import { warmDatabaseConnection } from './config/database.js'

const port = Number(process.env.PORT ?? 3000)

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}

async function startServer() {
  let warmupTimer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      warmDatabaseConnection(),
      new Promise<never>((_resolve, reject) => {
        warmupTimer = setTimeout(() => reject(new Error('Database warmup timed out.')), 3_000)
      }),
    ])
    console.log('Claros Auto database connection warmed')
  } catch {
    console.warn('Database warmup did not finish; the API will start and retry on demand.')
  } finally {
    if (warmupTimer) clearTimeout(warmupTimer)
  }

  app.listen(port, () => {
    console.log(`Claros Auto API listening on port ${port}`)
  })
}

void startServer()
