import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'frontend/src/**/*.test.ts?(x)',
      'backend/src/**/*.test.ts',
      'practica-5/tests/**/*.test.js',
    ],
  },
})
