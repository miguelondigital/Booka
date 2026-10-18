import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

// Prisma 7 no longer reads .env on its own. Load it when present; hosted
// environments (Render) inject variables directly.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` (run on install) does not need a database, so an
    // unset DATABASE_URL must not break installs in demo-only setups.
    url: process.env.DATABASE_URL ?? '',
  },
})
