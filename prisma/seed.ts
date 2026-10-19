/**
 * `npm run db:seed` (or `prisma db seed`). See backend/src/db/seed.ts.
 * Set DEMO_PASSWORD to make the demo accounts sign-in-able.
 */
import '../backend/src/env.js'
import { disconnectPrisma, getPrisma } from '../backend/src/db/client.js'
import { seedDatabase } from '../backend/src/db/seed.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

try {
  const { summary, demoLogins } = await seedDatabase(getPrisma(databaseUrl), {
    demoPassword: process.env.DEMO_PASSWORD || undefined,
  })
  console.log(summary)
  console.log(
    demoLogins
      ? 'Demo accounts can sign in with DEMO_PASSWORD: maya@, jordan@, riley@ and sam@example.com.'
      : 'DEMO_PASSWORD is not set: demo accounts were seeded without a password and cannot sign in.',
  )
} finally {
  await disconnectPrisma()
}
