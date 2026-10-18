/**
 * Idempotent demo seed: `npm run db:seed` (or `prisma db seed`).
 *
 * Upserts the demo club, book, checkpoints, members, threads and replies from
 * shared/fixtures.ts using their fixed ids. Re-running restores seeded records
 * (including the seeded members' progress) to their fixture values; threads and
 * replies created through the app are left untouched.
 */
import '../backend/src/env.js'
import { disconnectPrisma, getPrisma } from '../backend/src/db/client.js'
import { demoFixtures } from '../shared/fixtures.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const prisma = getPrisma(databaseUrl)
const { club, book, checkpoints, members, threads } = demoFixtures

try {
  await prisma.$transaction(
    async (tx) => {
      await tx.book.upsert({
        where: { id: book.id },
        create: book,
        update: { title: book.title, author: book.author },
      })

      const checkpointIds = new Map<number, string>()
      for (const checkpoint of checkpoints) {
        const row = await tx.checkpoint.upsert({
          where: { bookId_index: { bookId: book.id, index: checkpoint.index } },
          create: {
            id: checkpoint.id,
            bookId: book.id,
            index: checkpoint.index,
            label: checkpoint.label,
          },
          update: { label: checkpoint.label },
        })
        checkpointIds.set(checkpoint.index, row.id)
      }
      const checkpointId = (index: number) => {
        const id = checkpointIds.get(index)
        if (!id) throw new Error(`Fixture references unknown checkpoint index ${index}.`)
        return id
      }

      await tx.club.upsert({
        where: { id: club.id },
        create: { id: club.id, name: club.name, activeBookId: book.id },
        update: { name: club.name, activeBookId: book.id },
      })

      for (const member of members) {
        await tx.member.upsert({
          where: { id: member.id },
          create: { id: member.id, name: member.name },
          update: { name: member.name },
        })
        await tx.membership.upsert({
          where: { memberId_clubId: { memberId: member.id, clubId: club.id } },
          create: { memberId: member.id, clubId: club.id },
          update: {},
        })
        await tx.progress.upsert({
          where: { memberId_bookId: { memberId: member.id, bookId: book.id } },
          create: {
            memberId: member.id,
            bookId: book.id,
            checkpointId: checkpointId(member.checkpointIndex),
          },
          update: { checkpointId: checkpointId(member.checkpointIndex) },
        })
      }

      for (const thread of threads) {
        const threadData = {
          clubId: club.id,
          authorId: thread.authorId,
          checkpointId: checkpointId(thread.checkpointIndex),
          title: thread.title,
          body: thread.body,
          createdAt: new Date(thread.createdAt),
        }
        await tx.thread.upsert({
          where: { id: thread.id },
          create: { id: thread.id, ...threadData },
          update: threadData,
        })

        for (const reply of thread.replies) {
          const postData = {
            threadId: thread.id,
            authorId: reply.authorId,
            checkpointId: checkpointId(reply.checkpointIndex),
            body: reply.body,
            createdAt: new Date(reply.createdAt),
          }
          await tx.post.upsert({
            where: { id: reply.id },
            create: { id: reply.id, ...postData },
            update: postData,
          })
        }
      }
    },
    { timeout: 30_000 },
  )

  const replyCount = threads.reduce((sum, thread) => sum + thread.replies.length, 0)
  console.log(
    `Seeded "${club.name}" reading "${book.title}": ${checkpoints.length} checkpoints, ` +
      `${members.length} members, ${threads.length} threads, ${replyCount} replies.`,
  )
} finally {
  await disconnectPrisma()
}
