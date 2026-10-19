/**
 * Database verification: `npm run db:verify`.
 *
 * Confirms PostgreSQL is reachable, migrations are applied, the seed is
 * present and consistent, and — through the same service the API uses — that
 * no member's discussion of any book (current or past) contains anything
 * beyond their checkpoint. Exits non-zero on any failure.
 */
import '../backend/src/env.js'
import { disconnectPrisma, getPrisma } from '../backend/src/db/client.js'
import { createBookService } from '../backend/src/services/books.js'
import { demoClubs } from '../shared/fixtures.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const prisma = getPrisma(databaseUrl)
const books = createBookService(prisma)
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

  const demoIds = demoClubs.map((demo) => demo.club.id)
  const seeded = await prisma.club.count({ where: { id: { in: demoIds } } })
  check('Demo clubs present', seeded === demoIds.length, `${seeded}/${demoIds.length}`)

  const inverted = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM "Post" p
    JOIN "Thread" t ON t.id = p."threadId"
    JOIN "Checkpoint" pc ON pc.id = p."checkpointId"
    JOIN "Checkpoint" tc ON tc.id = t."checkpointId"
    WHERE pc.index < tc.index`
  check('No reply is stamped before its thread checkpoint', inverted[0]?.count === 0n)

  const crossBook = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM "Thread" t
    JOIN "Checkpoint" c ON c.id = t."checkpointId"
    WHERE c."bookId" <> t."bookId"`
  check('Every thread is stamped with a checkpoint of its own book', crossBook[0]?.count === 0n)

  const accounts = await prisma.member.count({
    where: { passwordHash: { not: null }, deletedAt: null },
  })
  check('Accounts that can sign in', true, String(accounts))

  const clubs = await prisma.club.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      books: {
        orderBy: { startedAt: 'desc' },
        include: { checkpoints: { orderBy: { index: 'asc' } } },
      },
      memberships: { include: { member: { select: { id: true, name: true } } } },
    },
  })

  const rows = []
  for (const club of clubs) {
    const ok = club.books.every(
      (book) =>
        book.checkpoints.length >= 2 &&
        book.checkpoints.every((checkpoint, position) => checkpoint.index === position),
    )
    check(`${club.name}: books have ordered checkpoints`, ok, `${club.books.length} book(s)`)

    for (const book of club.books) {
      for (const { member } of club.memberships) {
        const discussion = await books.getDiscussion(club.id, book.id, member.id)
        const index = discussion.readerCheckpointIndex
        const leaked = discussion.threads.some(
          (thread) =>
            thread.checkpointIndex > index ||
            thread.replies.some((reply) => reply.checkpointIndex > index),
        )
        if (leaked) failures++
        rows.push({
          club: club.name,
          book: `${book.title}${book === club.books[0] ? ' (current)' : ''}`,
          member: member.name,
          checkpoint: book.checkpoints[index]?.label ?? '?',
          threads: discussion.threads.length,
          replies: discussion.threads.reduce((sum, thread) => sum + thread.replies.length, 0),
          hidden: discussion.threads.reduce((sum, thread) => sum + thread.hiddenReplyCount, 0),
          leaks: leaked ? 'YES' : 'none',
        })
      }
    }
  }
  console.log('\nServer-filtered discussion for every member of every book:')
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
