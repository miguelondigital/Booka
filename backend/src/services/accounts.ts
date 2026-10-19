import type { PrismaClient } from '../generated/prisma/client.js'
import type {
  Account,
  AccountProfile,
  HistoryEntry,
  LoginInput,
  SignupInput,
} from '../../../shared/types.js'
import {
  LIMITS,
  normalizeEmail,
  validateEmail,
  validateLoginInput,
  validateName,
  validateSignupInput,
} from '../../../shared/validation.js'
import { hashPassword, rejectWithDummyCheck, verifyPassword } from '../auth/password.js'
import { HttpError, badRequest, conflict } from '../errors.js'
import { currentBookOrder } from './access.js'

const invalidCredentials = () => new HttpError(401, 'Email or password is incorrect.')
const emailTaken = () => conflict('An account with that email already exists.')
const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === 'P2002'

const ACCOUNT_FIELDS = { id: true, name: true, email: true } as const

export function createAccountService(prisma: PrismaClient) {
  /** Re-check the password for sensitive changes (email, account deletion). */
  async function confirmPassword(memberId: string, password: string) {
    const member = await prisma.member.findUniqueOrThrow({
      where: { id: memberId },
      select: { passwordHash: true },
    })
    const ok =
      password.length <= LIMITS.passwordMax &&
      member.passwordHash !== null &&
      (await verifyPassword(password, member.passwordHash))
    if (!ok) throw new HttpError(403, 'That password is not correct.')
  }

  return {
    /** New accounts start with no clubs: they create one or join with an invite. */
    async signup(input: SignupInput): Promise<Account> {
      const error = validateSignupInput(input)
      if (error) throw badRequest(error)
      const email = normalizeEmail(input.email)
      if (await prisma.member.findUnique({ where: { email }, select: { id: true } })) {
        throw conflict('An account with that email already exists. Try signing in.')
      }
      try {
        return await prisma.member.create({
          data: {
            name: input.name.trim(),
            email,
            passwordHash: await hashPassword(input.password),
          },
          select: ACCOUNT_FIELDS,
        })
      } catch (cause) {
        // Lost a race with a concurrent signup for the same email.
        if (isUniqueViolation(cause)) {
          throw conflict('An account with that email already exists. Try signing in.')
        }
        throw cause
      }
    },

    async login(input: LoginInput): Promise<Account> {
      if (validateLoginInput(input)) throw invalidCredentials()
      const member = await prisma.member.findUnique({
        where: { email: normalizeEmail(input.email) },
        select: { ...ACCOUNT_FIELDS, passwordHash: true },
      })
      if (!member?.passwordHash) {
        await rejectWithDummyCheck(input.password)
        throw invalidCredentials()
      }
      if (!(await verifyPassword(input.password, member.passwordHash))) throw invalidCredentials()
      return { id: member.id, name: member.name, email: member.email }
    },

    /** Account, reading history across all clubs, and clubs you own. */
    async profile(memberId: string): Promise<AccountProfile> {
      const [account, progress, memberships, owned] = await Promise.all([
        prisma.member.findUniqueOrThrow({ where: { id: memberId }, select: ACCOUNT_FIELDS }),
        prisma.progress.findMany({
          where: { memberId },
          include: {
            checkpoint: { select: { index: true, label: true } },
            book: {
              include: {
                club: { select: { id: true, name: true } },
                _count: { select: { checkpoints: true } },
              },
            },
          },
        }),
        prisma.membership.findMany({ where: { memberId }, select: { clubId: true } }),
        prisma.club.findMany({
          where: { ownerId: memberId },
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { memberships: true } } },
        }),
      ])

      const clubIds = [...new Set(progress.map((row) => row.book.clubId))]
      const currentBooks = await Promise.all(
        clubIds.map((clubId) =>
          prisma.book.findFirst({
            where: { clubId },
            orderBy: currentBookOrder,
            select: { id: true },
          }),
        ),
      )
      const currentIds = new Set(currentBooks.flatMap((book) => (book ? [book.id] : [])))
      const memberOf = new Set(memberships.map((membership) => membership.clubId))

      const history: HistoryEntry[] = progress
        .map(({ book, checkpoint }) => ({
          clubId: book.club.id,
          clubName: book.club.name,
          isMember: memberOf.has(book.club.id),
          bookId: book.id,
          title: book.title,
          author: book.author,
          isCurrent: currentIds.has(book.id),
          startedAt: book.startedAt.toISOString(),
          checkpointIndex: checkpoint.index,
          checkpointLabel: checkpoint.label,
          checkpointCount: book._count.checkpoints,
        }))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

      return {
        account,
        history,
        ownedClubs: owned.map((club) => ({
          id: club.id,
          name: club.name,
          otherMemberCount: club._count.memberships - 1,
        })),
      }
    },

    async updateName(memberId: string, name: string): Promise<Account> {
      const error = validateName(name)
      if (error) throw badRequest(error)
      return prisma.member.update({
        where: { id: memberId },
        data: { name: name.trim() },
        select: ACCOUNT_FIELDS,
      })
    },

    /** Changing the sign-in email requires the current password. */
    async changeEmail(memberId: string, email: string, password: string): Promise<Account> {
      const error = validateEmail(email)
      if (error) throw badRequest(error)
      await confirmPassword(memberId, password)
      try {
        return await prisma.member.update({
          where: { id: memberId },
          data: { email: normalizeEmail(email) },
          select: ACCOUNT_FIELDS,
        })
      } catch (cause) {
        if (isUniqueViolation(cause)) throw emailTaken()
        throw cause
      }
    },

    /**
     * Delete an account. Owners must first hand over clubs that have other
     * members; clubs where they are the only member are deleted. The member is
     * anonymised rather than removed, so their posts stay as "Former member".
     */
    async deleteAccount(memberId: string, password: string) {
      await confirmPassword(memberId, password)
      const owned = await prisma.club.findMany({
        where: { ownerId: memberId },
        include: { _count: { select: { memberships: true } } },
      })
      const shared = owned.filter((club) => club._count.memberships > 1)
      if (shared.length > 0) {
        throw conflict(
          `Choose a new owner for ${shared.map((club) => club.name).join(', ')} before deleting your account.`,
        )
      }
      await prisma.$transaction([
        prisma.club.deleteMany({ where: { id: { in: owned.map((club) => club.id) } } }),
        prisma.session.deleteMany({ where: { memberId } }),
        prisma.membership.deleteMany({ where: { memberId } }),
        prisma.clubBlock.deleteMany({ where: { memberId } }),
        prisma.progress.deleteMany({ where: { memberId } }),
        prisma.member.update({
          where: { id: memberId },
          data: {
            name: 'Former member',
            email: `deleted-${memberId}@members.invalid`,
            passwordHash: null,
            deletedAt: new Date(),
          },
        }),
      ])
    },
  }
}

export type AccountService = ReturnType<typeof createAccountService>
