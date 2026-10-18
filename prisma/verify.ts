/**
 * Database verification: `npm run db:verify`.
 *
 * Confirms PostgreSQL is reachable, migrations are applied, the demo seed is
 * present and consistent, and the visibility rule holds for every member at
 * their current checkpoint. Exits non-zero on any failure.
 */
import '../backend/src/env.js'
import { disconnectPrisma, getPrisma } from '../backend/src/db/client.js'
import { createPrismaRepository } from '../backend/src/repositories/prismaRepository.js'
import { demoFixtures } from '../shared/fixtures.js'
import { buildVisibleFeed } from '../shared/visibility.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const prisma = getPrisma(databaseUrl)
let failures = 0

function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '✔' : '✘'} ${label}${detail ? ` — ${detail}` : ''}`)
}

try {
  await prisma.$queryRaw`SELECT 1`
  check('Connected to PostgreSQL', true)

  const [{ count: applied } = { count: 0n }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
  check('Migrations applied', applied > 0n, `${applied} migration(s)`)

  const snapshot = await createPrismaRepository(prisma).getSnapshot()
  const { checkpoints, members, threads } = snapshot

  check(
    'Club with an active book',
    Boolean(snapshot.club.id && snapshot.book.id),
    `${snapshot.club.name} → ${snapshot.book.title}`,
  )

  const indexesContiguous = checkpoints.every(
    (checkpoint, position) => checkpoint.index === position,
  )
  check(
    'Book has 6–8 ordered checkpoints (indexes 0..n-1)',
    checkpoints.length >= 6 && checkpoints.length <= 8 && indexesContiguous,
    checkpoints.map((checkpoint) => `${checkpoint.index}:${checkpoint.label}`).join(', '),
  )

  const memberIds = new Set(members.map((member) => member.id))
  check(
    'Seeded demo members belong to the club with progress',
    demoFixtures.members.every((member) => memberIds.has(member.id)),
    members.map((member) => `${member.name}@${member.checkpointIndex}`).join(', '),
  )

  const threadIds = new Set(threads.map((thread) => thread.id))
  const replyIds = new Set(threads.flatMap((thread) => thread.replies.map((reply) => reply.id)))
  check(
    'Seeded threads and replies are present',
    demoFixtures.threads.every(
      (thread) =>
        threadIds.has(thread.id) && thread.replies.every((reply) => replyIds.has(reply.id)),
    ),
    `${threads.length} threads, ${replyIds.size} replies in database`,
  )

  const inverted = threads.flatMap((thread) =>
    thread.replies.filter((reply) => reply.checkpointIndex < thread.checkpointIndex),
  )
  check('No reply is stamped before its thread checkpoint', inverted.length === 0)

  console.log('\nVisibility at each member’s current checkpoint:')
  const rows = members.map((member) => {
    const feed = buildVisibleFeed(threads, member.checkpointIndex)
    const leaked = feed.some(
      (thread) =>
        thread.checkpointIndex > member.checkpointIndex ||
        thread.replies.some((reply) => reply.checkpointIndex > member.checkpointIndex),
    )
    if (leaked) failures++
    return {
      member: member.name,
      checkpoint: `${member.checkpointIndex} (${checkpoints[member.checkpointIndex]?.label ?? '?'})`,
      visibleThreads: feed.length,
      visibleReplies: feed.reduce((sum, thread) => sum + thread.replies.length, 0),
      hiddenReplies: feed.reduce((sum, thread) => sum + thread.hiddenReplyCount, 0),
      leaks: leaked ? 'YES' : 'none',
    }
  })
  console.table(rows)
} catch (error) {
  failures++
  console.error('✘ Verification failed:', error instanceof Error ? error.message : error)
} finally {
  await disconnectPrisma()
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nDatabase verified.')
