import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Load the root .env (for TEST_DATABASE_URL) before test workers start.
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    // Integration tests share one database.
    fileParallelism: false,
  },
})
