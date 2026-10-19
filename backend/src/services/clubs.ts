import type { PrismaClient } from '../generated/prisma/client.js'
import type {
  BookSummary,
  ClubCard,
  ClubDetail,
  InvitePreview,
  NewBookInput,
  NewClubInput,
} from '../../../shared/types.js'
import {
  normalizeInviteCode,
  validateBookInput,
  validateClubName,
} from '../../../shared/validation.js'
import { HttpError, badRequest, conflict, notFound } from '../errors.js'
import {
  currentBookOrder,
  requireMembership,
  requireOwner,
  withUniqueInviteCode,
} from './access.js'
import type { BookService } from './books.js'

const bookData = (input: NewBookInput) => ({
  title: input.title.trim(),
  author: input.author.trim(),
  checkpoints: {
    create: input.checkpoints.map((label, index) => ({ index, label: label.trim() })),
  },
})

const invalidInvite = () => notFound('That invite link is not valid. It may have been reset.')

/** Clubs, membership, invites and owner tools for a signed-in member. */
export function createClubService(prisma: PrismaClient, books: BookService) {
  async function card(clubId: string, memberId: string): Promise<ClubCard> {
    const club = await prisma.club.findUniqueOrThrow({
      where: { id: clubId },
      include: {
        _count: { select: { memberships: true } },
        books: {
          orderBy: currentBookOrder,
          take: 1,
          include: { checkpoints: { orderBy: { index: 'asc' }, select: { label: true } } },
        },
      },
    })
    const current = club.books[0]
    const members = current ? await books.membersIn(club.id, current.id) : []
    return {
      id: club.id,
      name: club.name,
      isOwner: club.ownerId === memberId,
      memberCount: club._count.memberships,
      currentBook: current
        ? {
            id: current.id,
            title: current.title,
            author: current.author,
            checkpointCount: current.checkpoints.length,
            checkpointLabels: current.checkpoints.map((checkpoint) => checkpoint.label),
          }
        : null,
      myCheckpointIndex: members.find((member) => member.id === memberId)?.checkpointIndex ?? null,
      members,
    }
  }

  return {
    /** Homepage: every club the member belongs to, oldest membership first. */
    async listCards(memberId: string): Promise<ClubCard[]> {
      const memberships = await prisma.membership.findMany({
        where: { memberId },
        orderBy: { joinedAt: 'asc' },
        select: { clubId: true },
      })
      return Promise.all(memberships.map(({ clubId }) => card(clubId, memberId)))
    },

    /** Anyone signed in can create a club; they become its owner. */
    async createClub(memberId: string, input: NewClubInput): Promise<ClubCard> {
      const error = validateClubName(input.name) ?? validateBookInput(input.book)
      if (error) throw badRequest(error)
      const club = await withUniqueInviteCode((inviteCode) =>
        prisma.club.create({
          data: {
            name: input.name.trim(),
            ownerId: memberId,
            inviteCode,
            memberships: { create: { memberId } },
            books: { create: bookData(input.book) },
          },
        }),
      )
      return card(club.id, memberId)
    },

    async getDetail(clubId: string, memberId: string): Promise<ClubDetail> {
      const club = await requireMembership(prisma, clubId, memberId)
      const isOwner = club.ownerId === memberId
      const [bookRows, memberships, blocks] = await Promise.all([
        prisma.book.findMany({
          where: { clubId },
          orderBy: currentBookOrder,
          include: { _count: { select: { checkpoints: true } } },
        }),
        prisma.membership.findMany({
          where: { clubId },
          orderBy: { joinedAt: 'asc' },
          include: { member: { select: { id: true, name: true } } },
        }),
        isOwner
          ? prisma.clubBlock.findMany({
              where: { clubId },
              orderBy: { createdAt: 'asc' },
              include: { member: { select: { id: true, name: true } } },
            })
          : Promise.resolve([]),
      ])
      return {
        club: { id: club.id, name: club.name },
        isOwner,
        ownerId: club.ownerId,
        inviteCode: club.inviteCode,
        books: bookRows.map((book, position) => ({
          id: book.id,
          title: book.title,
          author: book.author,
          startedAt: book.startedAt.toISOString(),
          isCurrent: position === 0,
          checkpointCount: book._count.checkpoints,
        })),
        members: memberships.map(({ member, joinedAt }) => ({
          id: member.id,
          name: member.name,
          isOwner: member.id === club.ownerId,
          joinedAt: joinedAt.toISOString(),
        })),
        blocked: blocks.map(({ member }) => ({ id: member.id, name: member.name })),
      }
    },

    async rename(clubId: string, memberId: string, name: string) {
      const error = validateClubName(name)
      if (error) throw badRequest(error)
      await requireOwner(prisma, clubId, memberId)
      await prisma.club.update({ where: { id: clubId }, data: { name: name.trim() } })
    },

    /** Deletes the club with all its books and discussion. */
    async deleteClub(clubId: string, memberId: string) {
      await requireOwner(prisma, clubId, memberId)
      await prisma.club.delete({ where: { id: clubId } })
    },

    /** New invite code; links with the old one stop working. */
    async resetInvite(clubId: string, memberId: string): Promise<string> {
      await requireOwner(prisma, clubId, memberId)
      const club = await withUniqueInviteCode((inviteCode) =>
        prisma.club.update({ where: { id: clubId }, data: { inviteCode } }),
      )
      return club.inviteCode
    },

    /** The owner starts the club's next book; earlier books stay browsable. */
    async startBook(clubId: string, memberId: string, input: NewBookInput): Promise<BookSummary> {
      const error = validateBookInput(input)
      if (error) throw badRequest(error)
      await requireOwner(prisma, clubId, memberId)
      const latest = await prisma.book.findFirst({
        where: { clubId },
        orderBy: currentBookOrder,
        select: { startedAt: true },
      })
      // Strictly after the previous book, so "current" is unambiguous.
      const startedAt = new Date(Math.max(Date.now(), (latest?.startedAt.getTime() ?? 0) + 1))
      const book = await prisma.book.create({
        data: { clubId, startedAt, ...bookData(input) },
        include: { _count: { select: { checkpoints: true } } },
      })
      return {
        id: book.id,
        title: book.title,
        author: book.author,
        startedAt: book.startedAt.toISOString(),
        isCurrent: true,
        checkpointCount: book._count.checkpoints,
      }
    },

    /**
     * Leave a club. Progress is kept so rejoining restores it, and posts stay.
     * The owner must hand over ownership first, unless they are the only
     * member, in which case leaving deletes the club.
     */
    async leave(clubId: string, memberId: string): Promise<{ clubDeleted: boolean }> {
      const club = await requireMembership(prisma, clubId, memberId)
      if (club.ownerId === memberId) {
        const others = await prisma.membership.count({
          where: { clubId, memberId: { not: memberId } },
        })
        if (others > 0) {
          throw conflict('Hand ownership to another member before leaving the club.')
        }
        await prisma.club.delete({ where: { id: clubId } })
        return { clubDeleted: true }
      }
      await prisma.membership.delete({ where: { memberId_clubId: { memberId, clubId } } })
      return { clubDeleted: false }
    },

    async transferOwnership(clubId: string, memberId: string, newOwnerId: string) {
      await requireOwner(prisma, clubId, memberId)
      if (newOwnerId === memberId) throw badRequest('You already own this club.')
      const target = await prisma.membership.findUnique({
        where: { memberId_clubId: { memberId: newOwnerId, clubId } },
      })
      if (!target) throw notFound('That person is not a member of this club.')
      await prisma.club.update({ where: { id: clubId }, data: { ownerId: newOwnerId } })
    },

    /** Remove a member and block them from rejoining through the invite link. */
    async removeMember(clubId: string, memberId: string, targetId: string) {
      const club = await requireOwner(prisma, clubId, memberId)
      if (targetId === club.ownerId) throw badRequest('The owner cannot be removed.')
      await prisma.$transaction(async (tx) => {
        const removed = await tx.membership.deleteMany({ where: { clubId, memberId: targetId } })
        if (removed.count === 0) throw notFound('That person is not a member of this club.')
        await tx.clubBlock.upsert({
          where: { clubId_memberId: { clubId, memberId: targetId } },
          create: { clubId, memberId: targetId },
          update: {},
        })
      })
    },

    /** Lift a block so the person can rejoin with the invite link. */
    async unblock(clubId: string, memberId: string, targetId: string) {
      await requireOwner(prisma, clubId, memberId)
      await prisma.clubBlock.deleteMany({ where: { clubId, memberId: targetId } })
    },

    async previewInvite(rawCode: string, memberId: string): Promise<InvitePreview> {
      const club = await prisma.club.findUnique({
        where: { inviteCode: normalizeInviteCode(rawCode) },
        include: {
          _count: { select: { memberships: true } },
          books: { orderBy: currentBookOrder, take: 1 },
          memberships: { where: { memberId }, select: { memberId: true } },
          blocks: { where: { memberId }, select: { memberId: true } },
        },
      })
      if (!club) throw invalidInvite()
      const current = club.books[0]
      return {
        club: { id: club.id, name: club.name },
        currentBook: current
          ? { id: current.id, title: current.title, author: current.author }
          : null,
        memberCount: club._count.memberships,
        alreadyMember: club.memberships.length > 0,
        blocked: club.blocks.length > 0,
      }
    },

    /** Join through an invite code. Joining a club you're already in is a no-op. */
    async joinWithInvite(rawCode: string, memberId: string): Promise<{ clubId: string }> {
      const club = await prisma.club.findUnique({
        where: { inviteCode: normalizeInviteCode(rawCode) },
        include: { blocks: { where: { memberId }, select: { memberId: true } } },
      })
      if (!club) throw invalidInvite()
      if (club.blocks.length > 0) throw new HttpError(403, 'You can no longer join this club.')
      // Idempotent and safe against double-submits.
      await prisma.membership.createMany({
        data: [{ memberId, clubId: club.id }],
        skipDuplicates: true,
      })
      return { clubId: club.id }
    },
  }
}

export type ClubService = ReturnType<typeof createClubService>
