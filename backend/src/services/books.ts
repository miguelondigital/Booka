import type { PrismaClient } from '../generated/prisma/client.js'
import type {
  BookOverview,
  Discussion,
  Member,
  NewReplyInput,
  NewThreadInput,
  ProgressResult,
  Reply,
  Thread,
  VisibleThread,
} from '../../../shared/types.js'
import {
  isCheckpointIndex,
  validateReplyInput,
  validateThreadInput,
} from '../../../shared/validation.js'
import { buildVisibleFeed, isVisibleAt } from '../../../shared/visibility.js'
import { badRequest, notFound } from '../errors.js'
import { currentBookOrder, requireMembership } from './access.js'

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

/**
 * Reading and discussing one book of a club, for a signed-in member.
 *
 * Discussion is filtered here, on the server, with the shared visibility rule
 * before it is returned. Hidden threads never leave this module and hidden
 * replies leave only as a count. Past books work exactly like the current one:
 * each member's progress in that book decides what they see.
 */
export function createBookService(prisma: PrismaClient) {
  /** Membership check + the book (with checkpoints) + the member's progress in it. */
  async function access(clubId: string, bookId: string, memberId: string) {
    const club = await requireMembership(prisma, clubId, memberId)
    const book = await prisma.book.findFirst({
      where: { id: bookId, clubId },
      include: { checkpoints: { orderBy: { index: 'asc' } } },
    })
    if (!book) throw notFound('Book not found.')

    let progress = await prisma.progress.findUnique({
      where: { memberId_bookId: { memberId, bookId } },
      include: { checkpoint: true },
    })
    // A member without progress in this book starts at its first checkpoint.
    // Parallel requests can race here, so insert with ON CONFLICT DO NOTHING
    // and read back whichever row won.
    if (!progress) {
      const first = book.checkpoints[0]
      if (!first) throw new Error(`Book ${book.id} has no checkpoints.`)
      await prisma.progress.createMany({
        data: [{ memberId, bookId, checkpointId: first.id }],
        skipDuplicates: true,
      })
      progress = await prisma.progress.findUniqueOrThrow({
        where: { memberId_bookId: { memberId, bookId } },
        include: { checkpoint: true },
      })
    }
    return { club, book, progress, readerIndex: progress.checkpoint.index }
  }

  /** All threads of a book, unfiltered. Internal only — never return this directly. */
  async function allThreads(bookId: string): Promise<Thread[]> {
    const threads = await prisma.thread.findMany({
      where: { bookId },
      orderBy: { createdAt: 'asc' },
      include: {
        checkpoint: true,
        posts: { orderBy: { createdAt: 'asc' }, include: { checkpoint: true } },
      },
    })
    return threads.map((thread) => ({
      id: thread.id,
      authorId: thread.authorId,
      title: thread.title,
      body: thread.body,
      checkpointIndex: thread.checkpoint.index,
      createdAt: thread.createdAt.toISOString(),
      replies: thread.posts.map(toReply),
    }))
  }

  async function discussionFor(bookId: string, readerIndex: number): Promise<Discussion> {
    return {
      readerCheckpointIndex: readerIndex,
      threads: buildVisibleFeed(await allThreads(bookId), readerIndex),
    }
  }

  /** Current club members with their checkpoint in the book (0 if not started). */
  async function membersIn(clubId: string, bookId: string): Promise<Member[]> {
    const memberships = await prisma.membership.findMany({
      where: { clubId },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            progress: { where: { bookId }, select: { checkpoint: { select: { index: true } } } },
          },
        },
      },
    })
    return memberships
      .map(({ member }) => ({
        id: member.id,
        name: member.name,
        checkpointIndex: member.progress[0]?.checkpoint.index ?? 0,
      }))
      .sort((a, b) => a.checkpointIndex - b.checkpointIndex || a.name.localeCompare(b.name))
  }

  return {
    membersIn,

    async getOverview(clubId: string, bookId: string, memberId: string): Promise<BookOverview> {
      const { club, book } = await access(clubId, bookId, memberId)
      const [members, current] = await Promise.all([
        membersIn(clubId, bookId),
        prisma.book.findFirst({
          where: { clubId },
          orderBy: currentBookOrder,
          select: { id: true },
        }),
      ])
      const me = members.find((member) => member.id === memberId)
      if (!me) throw notFound('Club not found.')
      return {
        club: { id: club.id, name: club.name },
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          startedAt: book.startedAt.toISOString(),
          isCurrent: current?.id === book.id,
          checkpointCount: book.checkpoints.length,
        },
        checkpoints: book.checkpoints.map(({ id, index, label }) => ({ id, index, label })),
        members,
        me,
      }
    },

    async getDiscussion(clubId: string, bookId: string, memberId: string): Promise<Discussion> {
      const { readerIndex } = await access(clubId, bookId, memberId)
      return discussionFor(bookId, readerIndex)
    },

    async updateProgress(
      clubId: string,
      bookId: string,
      memberId: string,
      checkpointIndex: unknown,
    ): Promise<ProgressResult> {
      const { book, progress } = await access(clubId, bookId, memberId)
      const checkpoint = isCheckpointIndex(checkpointIndex, book.checkpoints.length)
        ? book.checkpoints[checkpointIndex]
        : undefined
      if (!checkpoint) throw badRequest('checkpointIndex is not a checkpoint of this book.')
      const updated = await prisma.progress.update({
        where: { memberId_bookId: { memberId: progress.memberId, bookId } },
        data: { checkpointId: checkpoint.id },
        include: { member: { select: { name: true } } },
      })
      return {
        me: { id: memberId, name: updated.member.name, checkpointIndex: checkpoint.index },
        discussion: await discussionFor(bookId, checkpoint.index),
      }
    },

    async createThread(
      clubId: string,
      bookId: string,
      memberId: string,
      input: NewThreadInput,
    ): Promise<VisibleThread> {
      const error = validateThreadInput(input)
      if (error) throw badRequest(error)
      const { progress } = await access(clubId, bookId, memberId)
      const thread = await prisma.thread.create({
        data: {
          bookId,
          authorId: memberId,
          // Stamped from the author's stored progress, never from the request.
          checkpointId: progress.checkpointId,
          title: input.title.trim(),
          body: input.body.trim(),
        },
      })
      const createdAt = thread.createdAt.toISOString()
      return {
        id: thread.id,
        authorId: thread.authorId,
        title: thread.title,
        body: thread.body,
        checkpointIndex: progress.checkpoint.index,
        createdAt,
        replies: [],
        hiddenReplyCount: 0,
        lastActivityAt: createdAt,
      }
    },

    async createReply(
      clubId: string,
      bookId: string,
      memberId: string,
      threadId: string,
      input: NewReplyInput,
    ): Promise<Reply> {
      const error = validateReplyInput(input)
      if (error) throw badRequest(error)
      const { progress, readerIndex } = await access(clubId, bookId, memberId)
      const thread = await prisma.thread.findFirst({
        where: { id: threadId, bookId },
        include: { checkpoint: true },
      })
      // A thread beyond the member's checkpoint is reported as missing so its
      // existence is not revealed.
      if (!thread || !isVisibleAt(thread.checkpoint.index, readerIndex)) {
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

export type BookService = ReturnType<typeof createBookService>
