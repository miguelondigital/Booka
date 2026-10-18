import type { PrismaClient } from '../generated/prisma/client.js'
import type { Member, Reply, Thread } from '../../../shared/types.js'
import { isVisibleAt } from '../../../shared/visibility.js'
import {
  isCheckpointIndex,
  validateReplyInput,
  validateThreadInput,
} from '../../../shared/validation.js'
import { HttpError, badRequest, notFound } from '../errors.js'
import type { ClubRepository } from './clubRepository.js'

type PostRow = {
  id: string
  threadId: string
  authorId: string
  body: string
  createdAt: Date
  checkpoint: { index: number }
}

const toReply = (post: PostRow): Reply => ({
  id: post.id,
  threadId: post.threadId,
  authorId: post.authorId,
  body: post.body,
  checkpointIndex: post.checkpoint.index,
  createdAt: post.createdAt.toISOString(),
})

/** DATA_SOURCE=db: everything is read from and written to PostgreSQL. */
export function createPrismaRepository(prisma: PrismaClient): ClubRepository {
  // Single-club MVP: the oldest club is "the" club.
  async function activeClub() {
    const club = await prisma.club.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { activeBook: { include: { checkpoints: { orderBy: { index: 'asc' } } } } },
    })
    if (!club) throw new HttpError(503, 'The database has no club yet. Run `npm run db:seed`.')
    return club
  }

  /** The member's progress on the active book; also proves club membership. */
  async function memberProgress(memberId: string, clubId: string, bookId: string) {
    const progress = await prisma.progress.findFirst({
      where: { memberId, bookId, member: { memberships: { some: { clubId } } } },
      include: { checkpoint: true, member: true },
    })
    if (!progress) throw notFound('Member not found in this club.')
    return progress
  }

  return {
    async getSnapshot() {
      const club = await activeClub()
      const book = club.activeBook
      const [memberships, threads] = await Promise.all([
        prisma.membership.findMany({
          where: { clubId: club.id },
          include: {
            member: {
              include: { progress: { where: { bookId: book.id }, include: { checkpoint: true } } },
            },
          },
        }),
        prisma.thread.findMany({
          where: { clubId: club.id },
          orderBy: { createdAt: 'asc' },
          include: {
            checkpoint: true,
            posts: { orderBy: { createdAt: 'asc' }, include: { checkpoint: true } },
          },
        }),
      ])

      const members: Member[] = memberships
        .map(({ member }) => ({
          id: member.id,
          name: member.name,
          checkpointIndex: member.progress[0]?.checkpoint.index ?? 0,
        }))
        .sort((a, b) => a.checkpointIndex - b.checkpointIndex || a.name.localeCompare(b.name))

      return {
        club: { id: club.id, name: club.name },
        book: { id: book.id, title: book.title, author: book.author },
        checkpoints: book.checkpoints.map(({ id, index, label }) => ({ id, index, label })),
        members,
        threads: threads.map((thread): Thread => ({
          id: thread.id,
          authorId: thread.authorId,
          title: thread.title,
          body: thread.body,
          checkpointIndex: thread.checkpoint.index,
          createdAt: thread.createdAt.toISOString(),
          replies: thread.posts.map(toReply),
        })),
      }
    },

    async getClub(clubId) {
      const club = await prisma.club.findUnique({
        where: { id: clubId },
        include: { activeBook: { include: { checkpoints: { orderBy: { index: 'asc' } } } } },
      })
      if (!club) throw notFound('Club not found.')
      const { activeBook: book } = club
      return {
        club: { id: club.id, name: club.name },
        book: { id: book.id, title: book.title, author: book.author },
        checkpoints: book.checkpoints.map(({ id, index, label }) => ({ id, index, label })),
      }
    },

    async updateProgress(memberId, checkpointIndex) {
      const club = await activeClub()
      const checkpoint = isCheckpointIndex(checkpointIndex, club.activeBook.checkpoints.length)
        ? club.activeBook.checkpoints[checkpointIndex]
        : undefined
      if (!checkpoint) throw badRequest('checkpointIndex is not a checkpoint of this book.')
      const progress = await memberProgress(memberId, club.id, club.activeBookId)
      await prisma.progress.update({
        where: { memberId_bookId: { memberId, bookId: club.activeBookId } },
        data: { checkpointId: checkpoint.id },
      })
      return { id: memberId, name: progress.member.name, checkpointIndex: checkpoint.index }
    },

    async createThread(memberId, input) {
      const error = validateThreadInput(input)
      if (error) throw badRequest(error)
      const club = await activeClub()
      const progress = await memberProgress(memberId, club.id, club.activeBookId)
      const thread = await prisma.thread.create({
        data: {
          clubId: club.id,
          authorId: memberId,
          // Stamp from the author's stored progress, never from the request.
          checkpointId: progress.checkpointId,
          title: input.title.trim(),
          body: input.body.trim(),
        },
      })
      return {
        id: thread.id,
        authorId: thread.authorId,
        title: thread.title,
        body: thread.body,
        checkpointIndex: progress.checkpoint.index,
        createdAt: thread.createdAt.toISOString(),
        replies: [],
      }
    },

    async createReply(memberId, threadId, input) {
      const error = validateReplyInput(input)
      if (error) throw badRequest(error)
      const club = await activeClub()
      const progress = await memberProgress(memberId, club.id, club.activeBookId)
      const thread = await prisma.thread.findFirst({
        where: { id: threadId, clubId: club.id },
        include: { checkpoint: true },
      })
      // A thread beyond the member's checkpoint is reported as missing so its
      // existence is not revealed.
      if (!thread || !isVisibleAt(thread.checkpoint.index, progress.checkpoint.index)) {
        throw notFound('Thread not found.')
      }
      const post = await prisma.post.create({
        data: {
          threadId: thread.id,
          authorId: memberId,
          checkpointId: progress.checkpointId,
          body: input.body.trim(),
        },
        include: { checkpoint: true },
      })
      return toReply(post)
    },
  }
}
