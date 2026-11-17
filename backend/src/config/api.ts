const configuredOrigins = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

export const apiConfig = {
  allowedOrigins: new Set(configuredOrigins.split(',').map((origin) => origin.trim())),
}
