import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import { healthRouter } from './routes/health.js'

export const app = express()

app.use(express.json())
app.use('/api', healthRouter)
app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' })
})
app.use(errorHandler)
