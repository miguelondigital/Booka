import { randomInt } from 'node:crypto'
import type { PrismaClient } from '../generated/prisma/client.js'
import { HttpError, notFound } from '../errors.js'

export const forbidden = (message = 'Only the club owner can do that.') =>
  new HttpError(403, message)

/**
 * The club, if the member belongs to it. Non-members get a 404 (not 403) so
 * club ids cannot be probed.
 */
export async function requireMembership(prisma: PrismaClient, clubId: string, memberId: string) {
  const club = await prisma.club.findFirst({
    where: { id: clubId, memberships: { some: { memberId } } },
  })
  if (!club) throw notFound('Club not found.')
  return club
}

export async function requireOwner(prisma: PrismaClient, clubId: string, memberId: string) {
  const club = await requireMembership(prisma, clubId, memberId)
  if (club.ownerId !== memberId) throw forbidden()
  return club
}

/** A club's current book is the one started most recently. */
export const currentBookOrder = [{ startedAt: 'desc' as const }, { id: 'desc' as const }]

// No 0/O, 1/I/L: codes are easy to read aloud and type.
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const INVITE_LENGTH = 10

export function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < INVITE_LENGTH; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]
  return code
}

/** Retry an insert/update a few times if a generated invite code collides. */
export async function withUniqueInviteCode<T>(write: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write(generateInviteCode())
    } catch (error) {
      const isCollision =
        (error as { code?: string }).code === 'P2002' &&
        JSON.stringify((error as { meta?: unknown }).meta ?? '').includes('inviteCode')
      if (!isCollision || attempt >= 4) throw error
    }
  }
}
