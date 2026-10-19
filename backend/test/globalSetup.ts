import { execSync } from 'node:child_process'
import { disconnectPrisma, getPrisma } from '../src/db/client.js'
import { seedDatabase } from '../src/db/seed.js'
import { repoRoot } from '../src/env.js'
import { TEST_PASSWORD } from './support.js'

/**
 * When TEST_DATABASE_URL is set: migrate that database, wipe it, and seed the
 * demo data so every run starts from the same state. Without it, the
 * integration suite is skipped and only unit tests run.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) return
  if (url === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL: the tests wipe that database.')
  }

  execSync('npx prisma migrate deploy', {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  })

  const prisma = getPrisma(url)
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Post", "Thread", "Progress", "Membership", "Session", "Member", "Club", "Checkpoint", "Book" CASCADE',
  )
  await seedDatabase(prisma, { demoPassword: TEST_PASSWORD })
  await disconnectPrisma()
}
