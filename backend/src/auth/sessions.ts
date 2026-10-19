import { createHash, randomBytes } from 'node:crypto'
import type { CookieOptions, RequestHandler, Response } from 'express'
import type { PrismaClient } from '../generated/prisma/client.js'
import type { Account } from '../../../shared/types.js'
import { unauthorized } from '../errors.js'

export const SESSION_COOKIE = 'booka_session'

/** Only the hash of a session token is stored. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const separator = part.indexOf('=')
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      return undefined
    }
  }
  return undefined
}

export interface SessionSettings {
  secureCookies: boolean
  sessionTtlDays: number
}

function cookieOptions(settings: SessionSettings): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: settings.secureCookies, path: '/' }
}

export function createSessionStore(prisma: PrismaClient, settings: SessionSettings) {
  return {
    /** Start a session for the member and set the cookie on the response. */
    async start(res: Response, memberId: string) {
      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + settings.sessionTtlDays * 24 * 60 * 60 * 1000)
      await prisma.session.create({ data: { id: hashToken(token), memberId, expiresAt } })
      // Housekeeping: drop this member's expired sessions.
      await prisma.session.deleteMany({ where: { memberId, expiresAt: { lt: new Date() } } })
      res.cookie(SESSION_COOKIE, token, { ...cookieOptions(settings), expires: expiresAt })
    },

    async end(res: Response, token: string | undefined) {
      if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } })
      res.clearCookie(SESSION_COOKIE, cookieOptions(settings))
    },

    /** Attach the signed-in account (if any) to res.locals.account. */
    authenticate(): RequestHandler {
      return async (req, res, next) => {
        const token = readCookie(req.headers.cookie, SESSION_COOKIE)
        if (!token) return next()
        const session = await prisma.session.findUnique({
          where: { id: hashToken(token) },
          include: { member: { select: { id: true, name: true, email: true } } },
        })
        if (session && session.expiresAt > new Date()) {
          res.locals.account = session.member satisfies Account
        }
        next()
      }
    },
  }
}

export type SessionStore = ReturnType<typeof createSessionStore>

/** The signed-in account, or a 401. */
export function requireAccount(res: Response): Account {
  const account = res.locals.account as Account | undefined
  if (!account) throw unauthorized()
  return account
}

export function sessionToken(cookieHeader: string | undefined) {
  return readCookie(cookieHeader, SESSION_COOKIE)
}
