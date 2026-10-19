import type { PrismaClient } from '../generated/prisma/client.js'
import { demoClubs, demoMembers } from '../../../shared/fixtures.js'
import { hashPassword } from '../auth/password.js'

export interface SeedOptions {
  /**
   * Password for the demo accounts (maya@, jordan@, riley@, sam@example.com).
   * When omitted, demo members are created without a password and cannot
   * sign in; their seeded clubs and discussion are still there.
   */
  demoPassword?: string | undefined
}

/**
 * Idempotent seed: upserts the demo members, clubs, books, checkpoints,
 * memberships, progress, threads and replies from shared/fixtures.ts by their
 * fixed ids. Re-running restores those records (including the demo members'
 * progress, club owners and invite codes) to their fixture values; accounts,
 * clubs, books and posts created through the app are kept.
 */
export async function seedDatabase(prisma: PrismaClient, { demoPassword }: SeedOptions = {}) {
  const passwordHash = demoPassword ? await hashPassword(demoPassword) : null
  let threadCount = 0
  let replyCount = 0

  await prisma.$transaction(
    async (tx) => {
      for (const member of demoMembers) {
        await tx.member.upsert({
          where: { id: member.id },
          create: { id: member.id, name: member.name, email: member.email, passwordHash },
          // Without DEMO_PASSWORD, existing passwords are left as they are.
          update: {
            name: member.name,
            email: member.email,
            deletedAt: null,
            ...(passwordHash ? { passwordHash } : {}),
          },
        })
      }

      for (const demo of demoClubs) {
        const clubData = {
          name: demo.club.name,
          ownerId: demo.ownerId,
          inviteCode: demo.inviteCode,
        }
        await tx.club.upsert({
          where: { id: demo.club.id },
          create: { id: demo.club.id, ...clubData },
          update: clubData,
        })
        for (const memberId of demo.memberIds) {
          await tx.membership.upsert({
            where: { memberId_clubId: { memberId, clubId: demo.club.id } },
            create: { memberId, clubId: demo.club.id },
            update: {},
          })
          await tx.clubBlock.deleteMany({ where: { clubId: demo.club.id, memberId } })
        }

        for (const { book, startedAt, checkpoints, progress, threads } of demo.books) {
          const bookData = {
            clubId: demo.club.id,
            title: book.title,
            author: book.author,
            startedAt: new Date(startedAt),
          }
          await tx.book.upsert({
            where: { id: book.id },
            create: { id: book.id, ...bookData },
            update: bookData,
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
            if (!id) throw new Error(`${book.id} has no checkpoint ${index}.`)
            return id
          }

          for (const [memberId, index] of Object.entries(progress)) {
            await tx.progress.upsert({
              where: { memberId_bookId: { memberId, bookId: book.id } },
              create: { memberId, bookId: book.id, checkpointId: checkpointId(index) },
              update: { checkpointId: checkpointId(index) },
            })
          }

          for (const thread of threads) {
            const threadData = {
              bookId: book.id,
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
            threadCount++

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
              replyCount++
            }
          }
        }
      }
    },
    { timeout: 60_000 },
  )

  const bookCount = demoClubs.reduce((sum, demo) => sum + demo.books.length, 0)
  return {
    summary:
      `Seeded ${demoMembers.length} members, ${demoClubs.length} clubs, ${bookCount} books, ` +
      `${threadCount} threads and ${replyCount} replies.`,
    demoLogins: Boolean(passwordHash),
  }
}
