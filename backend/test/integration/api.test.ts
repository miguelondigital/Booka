import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { saltOrchard } from '../../../shared/fixtures.js'
import type {
  Account,
  AccountProfile,
  BookOverview,
  BookSummary,
  ClubCard,
  ClubDetail,
  Discussion,
  InvitePreview,
  ProgressResult,
  Reply,
  VisibleThread,
} from '../../../shared/types.js'
import { disconnectPrisma } from '../../src/db/client.js'
import { createClient, startTestServer } from '../support.js'

// Opt-in: set TEST_DATABASE_URL to a disposable database (wiped by globalSetup).
const databaseUrl = process.env.TEST_DATABASE_URL

const THURSDAY = 'club-thursday-readers'
const HARBOUR = 'club-harbour-lights'
const SALT = 'book-salt-orchard'
const GLASS = 'book-glass-cartographer' // Harbour's past book
const FEN = 'book-harrow-fen' // Harbour's current book
const THURSDAY_INVITE = 'SALTORCH01'
const HARBOUR_INVITE = 'HARBOUR001'

const bookPath = (clubId: string, bookId: string) => `/api/clubs/${clubId}/books/${bookId}`
const allSaltReplies = saltOrchard.threads.flatMap((thread) => thread.replies)

type Client = ReturnType<typeof createClient>

describe.skipIf(!databaseUrl)('API (PostgreSQL)', () => {
  let server: Server
  let baseUrl: string
  let userCount = 0

  beforeAll(async () => {
    ;({ server, baseUrl } = await startTestServer(databaseUrl!))
  })
  afterAll(async () => {
    server.close()
    await disconnectPrisma()
  })

  const json = async <T>(response: Response | Promise<Response>) =>
    (await (await response).json()) as T

  const signedIn = async (email: string) => {
    const client = createClient(baseUrl)
    expect((await client.login(email)).status).toBe(200)
    return client
  }

  /** A brand-new account with its own client. */
  const newUser = async (name = 'Tester') => {
    const client = createClient(baseUrl)
    const email = `user${++userCount}@test.example`
    const response = await client.request('/api/auth/signup', {
      method: 'POST',
      body: { name, email, password: 'a-long-password' },
    })
    expect(response.status).toBe(201)
    const { account } = await json<{ account: Account }>(response)
    return { client, account, email }
  }

  const join = (client: Client, code: string) =>
    client.request(`/api/invites/${code}/join`, { method: 'POST', body: {} })

  const discussion = (client: Client, clubId: string, bookId: string) =>
    json<Discussion>(client.request(`${bookPath(clubId, bookId)}/discussion`))

  const createClub = async (client: Client, name = 'Test Club') => {
    const response = await client.request('/api/clubs', {
      method: 'POST',
      body: {
        name,
        book: { title: 'Test Book', author: 'A. Writer', checkpoints: ['Part 1', 'Part 2', 'End'] },
      },
    })
    expect(response.status).toBe(201)
    return json<ClubCard>(response)
  }

  const detail = (client: Client, clubId: string) =>
    json<ClubDetail>(client.request(`/api/clubs/${clubId}`))

  describe('health', () => {
    it('reports the server and database as up', async () => {
      const client = createClient(baseUrl)
      expect((await client.request('/api/health')).status).toBe(200)
      const db = await client.request('/api/health/db')
      expect(db.status).toBe(200)
      expect(await db.json()).toMatchObject({ database: 'connected' })
    })
  })

  describe('authentication', () => {
    it('rejects anonymous access', async () => {
      const client = createClient(baseUrl)
      for (const path of [
        '/api/auth/me',
        '/api/account',
        '/api/clubs',
        `/api/clubs/${THURSDAY}`,
        `${bookPath(THURSDAY, SALT)}/discussion`,
        `/api/invites/${THURSDAY_INVITE}`,
      ]) {
        expect((await client.request(path)).status, path).toBe(401)
      }
    })

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const wrongPassword = await createClient(baseUrl).login('maya@example.com', 'nope-nope-nope')
      const unknownEmail = await createClient(baseUrl).login('nobody@example.com', 'nope-nope-nope')
      expect(wrongPassword.status).toBe(401)
      expect(unknownEmail.status).toBe(401)
      expect(await wrongPassword.json()).toEqual(await unknownEmail.json())
    })

    it('signs in with an HttpOnly, SameSite=Lax session cookie', async () => {
      const client = createClient(baseUrl)
      const response = await client.login('MAYA@example.com ')
      const setCookie = response.headers.get('set-cookie') ?? ''
      expect(setCookie).toMatch(/booka_session=/)
      expect(setCookie).toMatch(/HttpOnly/i)
      expect(setCookie).toMatch(/SameSite=Lax/i)
      const me = await json<{ account: Account }>(client.request('/api/auth/me'))
      expect(me.account).toEqual({ id: 'member-maya', name: 'Maya', email: 'maya@example.com' })
    })

    it('never returns password hashes', async () => {
      const client = await signedIn('maya@example.com')
      for (const path of ['/api/auth/me', '/api/account', '/api/clubs', `/api/clubs/${HARBOUR}`]) {
        expect(await (await client.request(path)).text()).not.toMatch(/scrypt|passwordHash/)
      }
    })

    it('ends the session on logout, including for a replayed cookie', async () => {
      const client = await signedIn('jordan@example.com')
      const stolen = client.cookie
      expect((await client.request('/api/auth/logout', { method: 'POST', body: {} })).status).toBe(
        204,
      )
      expect((await client.request('/api/auth/me')).status).toBe(401)
      client.cookie = stolen
      expect((await client.request('/api/auth/me')).status).toBe(401)
    })

    it('rejects forged session tokens', async () => {
      const client = createClient(baseUrl)
      client.cookie = 'booka_session=not-a-real-token'
      expect((await client.request('/api/auth/me')).status).toBe(401)
    })

    it('signs up into an empty homepage and rejects duplicate emails', async () => {
      const { client, email } = await newUser('Sam Two')
      expect((await json<{ clubs: ClubCard[] }>(client.request('/api/clubs'))).clubs).toEqual([])
      const duplicate = await createClient(baseUrl).request('/api/auth/signup', {
        method: 'POST',
        body: { name: 'Dup', email: email.toUpperCase(), password: 'another-password' },
      })
      expect(duplicate.status).toBe(409)
    })

    it('validates signup input', async () => {
      const response = await createClient(baseUrl).request('/api/auth/signup', {
        method: 'POST',
        body: { name: 'Short', email: 'short@example.com', password: '123' },
      })
      expect(response.status).toBe(400)
    })
  })

  describe('homepage', () => {
    it("lists every club with the current book, your progress and club-mates' progress", async () => {
      const maya = await signedIn('maya@example.com')
      const { clubs } = await json<{ clubs: ClubCard[] }>(maya.request('/api/clubs'))
      expect(clubs.map((club) => club.id).sort()).toEqual([HARBOUR, THURSDAY])

      const thursday = clubs.find((club) => club.id === THURSDAY)!
      expect(thursday).toMatchObject({ isOwner: false, memberCount: 3, myCheckpointIndex: 1 })
      expect(thursday.currentBook).toMatchObject({ id: SALT, checkpointCount: 6 })
      expect(thursday.members.map((member) => [member.name, member.checkpointIndex])).toEqual([
        ['Maya', 1],
        ['Jordan', 3],
        ['Riley', 5],
      ])

      const harbour = clubs.find((club) => club.id === HARBOUR)!
      expect(harbour).toMatchObject({ isOwner: true, myCheckpointIndex: 2 })
      expect(harbour.currentBook?.id).toBe(FEN)
    })

    it('contains no discussion content', async () => {
      const maya = await signedIn('maya@example.com')
      const raw = await (await maya.request('/api/clubs')).text()
      for (const thread of saltOrchard.threads) expect(raw).not.toContain(thread.title)
    })
  })

  describe('server-side visibility (acceptance tests)', () => {
    it('member at checkpoint 1 receives nothing from checkpoints 2 through 5', async () => {
      const result = await discussion(await signedIn('maya@example.com'), THURSDAY, SALT)
      expect(result.readerCheckpointIndex).toBe(1)
      expect(new Set(result.threads.map((thread) => thread.id))).toEqual(
        new Set(['thread-cedar-chest', 'thread-first-impressions']),
      )
      const raw = JSON.stringify(result)
      for (const thread of saltOrchard.threads.filter((t) => t.checkpointIndex > 1)) {
        expect(raw).not.toContain(thread.title)
        expect(raw).not.toContain(thread.body)
      }
      for (const reply of allSaltReplies.filter((r) => r.checkpointIndex > 1)) {
        expect(raw).not.toContain(reply.id)
        expect(raw).not.toContain(reply.body)
      }
    })

    it('replaces hidden replies with a count only', async () => {
      const result = await discussion(await signedIn('maya@example.com'), THURSDAY, SALT)
      const thread = result.threads.find((t) => t.id === 'thread-first-impressions')!
      expect(thread.replies.map((reply) => reply.id)).toEqual(['reply-first-impressions-1'])
      expect(thread.hiddenReplyCount).toBe(2)
    })

    it('member at checkpoint 3 receives posts and replies from checkpoints 0 through 3', async () => {
      const result = await discussion(await signedIn('jordan@example.com'), THURSDAY, SALT)
      const indexes = result.threads.flatMap((thread) => [
        thread.checkpointIndex,
        ...thread.replies.map((reply) => reply.checkpointIndex),
      ])
      expect(new Set(indexes)).toEqual(new Set([0, 1, 2, 3]))
    })

    it('member at checkpoint 5 receives every seeded post and reply', async () => {
      const result = await discussion(await signedIn('riley@example.com'), THURSDAY, SALT)
      const ids = new Set(result.threads.map((thread) => thread.id))
      for (const thread of saltOrchard.threads) expect(ids.has(thread.id)).toBe(true)
      const replyIds = new Set(result.threads.flatMap((t) => t.replies.map((r) => r.id)))
      for (const reply of allSaltReplies) expect(replyIds.has(reply.id)).toBe(true)
    })
  })

  describe('past books', () => {
    it("still filter by each member's checkpoint in that book", async () => {
      const riley = await signedIn('riley@example.com')
      const past = await discussion(riley, HARBOUR, GLASS)
      expect(past.readerCheckpointIndex).toBe(1)
      expect(past.threads.map((thread) => thread.id)).toEqual(['thread-ilse-map'])
      expect(past.threads[0]).toMatchObject({ hiddenReplyCount: 1 })
      expect(JSON.stringify(past)).not.toContain('the coast moved')

      const overview = await json<BookOverview>(riley.request(bookPath(HARBOUR, GLASS)))
      expect(overview.book).toMatchObject({ isCurrent: false, checkpointCount: 4 })
    })

    it('stay open: progress can still move and members can still post', async () => {
      const riley = await signedIn('riley@example.com')
      const moved = await json<ProgressResult>(
        riley.request(`${bookPath(HARBOUR, GLASS)}/progress`, {
          method: 'PUT',
          body: { checkpointIndex: 3 },
        }),
      )
      expect(moved.discussion.threads).toHaveLength(3)
      const posted = await riley.request(`${bookPath(HARBOUR, GLASS)}/threads`, {
        method: 'POST',
        body: { title: 'Finally finished', body: 'What an epilogue.' },
      })
      expect(posted.status).toBe(201)
      expect(((await posted.json()) as VisibleThread).checkpointIndex).toBe(3)
    })

    it('handles a new member opening a book with parallel requests', async () => {
      // Each first visit lazily creates progress; parallel requests must not collide.
      for (let attempt = 0; attempt < 5; attempt++) {
        const { client } = await newUser('Parallel')
        await join(client, HARBOUR_INVITE)
        const responses = await Promise.all(
          Array.from({ length: 6 }, (_, i) =>
            client.request(
              i % 2 ? bookPath(HARBOUR, GLASS) : `${bookPath(HARBOUR, GLASS)}/discussion`,
            ),
          ),
        )
        expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 200])
      }
    })

    it("cannot be reached through another club's path", async () => {
      const maya = await signedIn('maya@example.com')
      expect((await maya.request(bookPath(THURSDAY, FEN))).status).toBe(404)
    })
  })

  describe('posting and progress', () => {
    it("stamps new threads with the author's checkpoint and ignores a client-supplied one", async () => {
      const maya = await signedIn('maya@example.com')
      const response = await maya.request(`${bookPath(THURSDAY, SALT)}/threads`, {
        method: 'POST',
        body: { title: 'Elias and the chest', body: 'He knows something.', checkpointIndex: 5 },
      })
      expect(response.status).toBe(201)
      const thread = (await response.json()) as VisibleThread
      expect(thread.checkpointIndex).toBe(1)

      const jordanIds = (await discussion(await signedIn('jordan@example.com'), THURSDAY, SALT))
        .threads
      expect(jordanIds.map((t) => t.id)).toContain(thread.id)
      const { client: newcomer } = await newUser('Nova')
      await join(newcomer, THURSDAY_INVITE)
      const newcomerIds = (await discussion(newcomer, THURSDAY, SALT)).threads.map((t) => t.id)
      expect(newcomerIds).not.toContain(thread.id)
    })

    it('stamps replies and refuses replies to threads beyond the checkpoint', async () => {
      const maya = await signedIn('maya@example.com')
      const ok = await maya.request(
        `${bookPath(THURSDAY, SALT)}/threads/thread-cedar-chest/replies`,
        {
          method: 'POST',
          body: { body: 'Maybe M. is Wren’s mother?', checkpointIndex: 0 },
        },
      )
      expect(ok.status).toBe(201)
      expect(((await ok.json()) as Reply).checkpointIndex).toBe(1)

      const hidden = await maya.request(
        `${bookPath(THURSDAY, SALT)}/threads/thread-ending/replies`,
        {
          method: 'POST',
          body: { body: 'Sneaky' },
        },
      )
      expect(hidden.status).toBe(404)
    })

    it('returns the newly visible discussion with a progress change', async () => {
      const { client } = await newUser('Pat')
      await join(client, THURSDAY_INVITE)
      const before = await discussion(client, THURSDAY, SALT)
      const result = await json<ProgressResult>(
        client.request(`${bookPath(THURSDAY, SALT)}/progress`, {
          method: 'PUT',
          body: { checkpointIndex: 3 },
        }),
      )
      expect(result.me.checkpointIndex).toBe(3)
      expect(result.discussion.threads.length).toBeGreaterThan(before.threads.length)
      expect(result.discussion.threads.every((thread) => thread.checkpointIndex <= 3)).toBe(true)

      const outOfRange = await client.request(`${bookPath(THURSDAY, SALT)}/progress`, {
        method: 'PUT',
        body: { checkpointIndex: 99 },
      })
      expect(outOfRange.status).toBe(400)
    })

    it('validates thread input', async () => {
      const maya = await signedIn('maya@example.com')
      const response = await maya.request(`${bookPath(THURSDAY, SALT)}/threads`, {
        method: 'POST',
        body: { title: '   ', body: 'x' },
      })
      expect(response.status).toBe(400)
    })
  })

  describe('creating clubs', () => {
    it('makes the creator the owner and only member, with an invite code', async () => {
      const { client, account } = await newUser('Founder')
      const card = await createClub(client, 'Founders Circle')
      expect(card).toMatchObject({ name: 'Founders Circle', isOwner: true, memberCount: 1 })
      expect(card.currentBook).toMatchObject({ title: 'Test Book', checkpointCount: 3 })
      expect(card.myCheckpointIndex).toBe(0)

      const club = await detail(client, card.id)
      expect(club.ownerId).toBe(account.id)
      expect(club.inviteCode).toMatch(/^[A-Z2-9]{10}$/)
      expect(club.members.map((member) => member.name)).toEqual(['Founder'])
    })

    it('validates the club and book', async () => {
      const { client } = await newUser()
      for (const body of [
        { name: '', book: { title: 'T', author: 'A', checkpoints: ['a', 'b'] } },
        { name: 'Club', book: { title: 'T', author: 'A', checkpoints: ['only one'] } },
        { name: 'Club', book: { title: '', author: 'A', checkpoints: ['a', 'b'] } },
        { name: 'Club', book: { title: 'T', author: 'A', checkpoints: ['a', '  '] } },
      ]) {
        expect((await client.request('/api/clubs', { method: 'POST', body })).status).toBe(400)
      }
    })
  })

  describe('invites', () => {
    it('previews and joins with a code typed in any case, idempotently', async () => {
      const { client } = await newUser('Joiner')
      const preview = await json<InvitePreview>(client.request('/api/invites/harbour-001'))
      expect(preview).toMatchObject({
        club: { id: HARBOUR },
        currentBook: { id: FEN },
        alreadyMember: false,
        blocked: false,
      })
      expect(await json(join(client, HARBOUR_INVITE))).toEqual({ clubId: HARBOUR })
      expect((await join(client, HARBOUR_INVITE)).status).toBe(200)
      const { clubs } = await json<{ clubs: ClubCard[] }>(client.request('/api/clubs'))
      expect(clubs.map((club) => club.id)).toEqual([HARBOUR])
      expect(
        (await json<InvitePreview>(client.request(`/api/invites/${HARBOUR_INVITE}`))).alreadyMember,
      ).toBe(true)
    })

    it('rejects unknown codes', async () => {
      const { client } = await newUser()
      expect((await client.request('/api/invites/NOPENOPE99')).status).toBe(404)
      expect((await join(client, 'NOPENOPE99')).status).toBe(404)
    })

    it('shows the code to every member, but only the owner can reset it', async () => {
      const { client: owner } = await newUser('Owner')
      const card = await createClub(owner)
      const oldCode = (await detail(owner, card.id)).inviteCode
      const { client: member } = await newUser('Member')
      await join(member, oldCode)
      expect((await detail(member, card.id)).inviteCode).toBe(oldCode)

      const denied = await member.request(`/api/clubs/${card.id}/invite/reset`, {
        method: 'POST',
        body: {},
      })
      expect(denied.status).toBe(403)

      const { inviteCode } = await json<{ inviteCode: string }>(
        owner.request(`/api/clubs/${card.id}/invite/reset`, { method: 'POST', body: {} }),
      )
      expect(inviteCode).not.toBe(oldCode)
      const { client: late } = await newUser('Late')
      expect((await join(late, oldCode)).status).toBe(404)
      expect((await join(late, inviteCode)).status).toBe(200)
    })
  })

  describe('owner tools', () => {
    it('only the owner can rename the club', async () => {
      const { client: owner } = await newUser('Owner')
      const card = await createClub(owner)
      const { client: member } = await newUser('Member')
      await join(member, (await detail(owner, card.id)).inviteCode)

      const rename = (client: Client, name: string) =>
        client.request(`/api/clubs/${card.id}`, { method: 'PATCH', body: { name } })
      expect((await rename(member, 'Hijacked')).status).toBe(403)
      expect((await rename(owner, 'Renamed Club')).status).toBe(204)
      expect((await detail(member, card.id)).club.name).toBe('Renamed Club')
    })

    it('removes and blocks members until the owner lifts the block', async () => {
      const { client: owner } = await newUser('Owner')
      const card = await createClub(owner)
      const code = (await detail(owner, card.id)).inviteCode
      const { client: member, account } = await newUser('Removed')
      await join(member, code)

      const remove = await owner.request(`/api/clubs/${card.id}/members/${account.id}`, {
        method: 'DELETE',
        body: {},
      })
      expect(remove.status).toBe(204)
      expect((await member.request(`/api/clubs/${card.id}`)).status).toBe(404)
      expect((await json<InvitePreview>(member.request(`/api/invites/${code}`))).blocked).toBe(true)
      expect((await join(member, code)).status).toBe(403)
      expect((await detail(owner, card.id)).blocked.map((b) => b.id)).toEqual([account.id])

      const unblock = await owner.request(`/api/clubs/${card.id}/blocks/${account.id}`, {
        method: 'DELETE',
        body: {},
      })
      expect(unblock.status).toBe(204)
      expect((await join(member, code)).status).toBe(200)
    })

    it('hides the block list from non-owners and refuses to remove the owner', async () => {
      const { client: owner, account: ownerAccount } = await newUser('Owner')
      const card = await createClub(owner)
      const { client: member } = await newUser('Member')
      await join(member, (await detail(owner, card.id)).inviteCode)
      expect((await detail(member, card.id)).blocked).toEqual([])
      const removeOwner = await owner.request(`/api/clubs/${card.id}/members/${ownerAccount.id}`, {
        method: 'DELETE',
        body: {},
      })
      expect(removeOwner.status).toBe(400)
      const memberRemoves = await member.request(
        `/api/clubs/${card.id}/members/${ownerAccount.id}`,
        {
          method: 'DELETE',
          body: {},
        },
      )
      expect(memberRemoves.status).toBe(403)
    })

    it('starts the next book; the previous one stays with its progress', async () => {
      const { client: owner } = await newUser('Owner')
      const card = await createClub(owner)
      const firstBook = card.currentBook!.id
      await owner.request(`${bookPath(card.id, firstBook)}/progress`, {
        method: 'PUT',
        body: { checkpointIndex: 2 },
      })
      const { client: member } = await newUser('Member')
      await join(member, (await detail(owner, card.id)).inviteCode)

      const next = { title: 'Second Book', author: 'B. Writer', checkpoints: ['One', 'Two', 'End'] }
      const denied = await member.request(`/api/clubs/${card.id}/books`, {
        method: 'POST',
        body: next,
      })
      expect(denied.status).toBe(403)
      const started = await owner.request(`/api/clubs/${card.id}/books`, {
        method: 'POST',
        body: next,
      })
      expect(started.status).toBe(201)
      const newBook = (await started.json()) as BookSummary

      const club = await detail(member, card.id)
      expect(club.books.map((book) => [book.id, book.isCurrent])).toEqual([
        [newBook.id, true],
        [firstBook, false],
      ])
      const past = await json<BookOverview>(owner.request(bookPath(card.id, firstBook)))
      expect(past.me.checkpointIndex).toBe(2)
      const current = await json<BookOverview>(owner.request(bookPath(card.id, newBook.id)))
      expect(current.me.checkpointIndex).toBe(0)
      const [homeCard] = (await json<{ clubs: ClubCard[] }>(owner.request('/api/clubs'))).clubs
      expect(homeCard?.currentBook?.id).toBe(newBook.id)
    })

    it('requires the owner to hand over ownership before leaving', async () => {
      const { client: owner } = await newUser('Owner')
      const card = await createClub(owner)
      const { client: member, account: memberAccount } = await newUser('Heir')
      await join(member, (await detail(owner, card.id)).inviteCode)

      const leave = (client: Client) =>
        client.request(`/api/clubs/${card.id}/leave`, { method: 'POST', body: {} })
      expect((await leave(owner)).status).toBe(409)

      const transfer = await owner.request(`/api/clubs/${card.id}/owner`, {
        method: 'POST',
        body: { memberId: memberAccount.id },
      })
      expect(transfer.status).toBe(204)
      expect(await json(leave(owner))).toEqual({ clubDeleted: false })
      const club = await detail(member, card.id)
      expect(club).toMatchObject({ isOwner: true, ownerId: memberAccount.id })
      expect(club.members.map((m) => m.name)).toEqual(['Heir'])

      // The last member leaving deletes the club.
      expect(await json(leave(member))).toEqual({ clubDeleted: true })
      expect((await member.request(`/api/clubs/${card.id}`)).status).toBe(404)
    })

    it("keeps a leaver's posts but drops them from the member list", async () => {
      const { client: owner } = await newUser('Owner')
      const card = await createClub(owner)
      const bookId = card.currentBook!.id
      const { client: member, account } = await newUser('Leaver')
      await join(member, (await detail(owner, card.id)).inviteCode)
      await member.request(`${bookPath(card.id, bookId)}/threads`, {
        method: 'POST',
        body: { title: 'Before I go', body: 'Bye!' },
      })
      await member.request(`/api/clubs/${card.id}/leave`, { method: 'POST', body: {} })

      const threads = (await discussion(owner, card.id, bookId)).threads
      expect(threads.map((thread) => [thread.title, thread.authorId])).toEqual([
        ['Before I go', account.id],
      ])
      const overview = await json<BookOverview>(owner.request(bookPath(card.id, bookId)))
      expect(overview.members.map((m) => m.id)).not.toContain(account.id)
    })

    it('only the owner can delete the club', async () => {
      const { client: owner } = await newUser('Owner')
      const card = await createClub(owner)
      const { client: member } = await newUser('Member')
      await join(member, (await detail(owner, card.id)).inviteCode)
      expect(
        (await member.request(`/api/clubs/${card.id}`, { method: 'DELETE', body: {} })).status,
      ).toBe(403)
      expect(
        (await owner.request(`/api/clubs/${card.id}`, { method: 'DELETE', body: {} })).status,
      ).toBe(204)
      expect((await owner.request(`/api/clubs/${card.id}`)).status).toBe(404)
      expect((await json<{ clubs: ClubCard[] }>(member.request('/api/clubs'))).clubs).toEqual([])
    })
  })

  describe('account', () => {
    it('shows reading history across clubs, including past books', async () => {
      const maya = await signedIn('maya@example.com')
      const profile = await json<AccountProfile>(maya.request('/api/account'))
      expect(profile.account.email).toBe('maya@example.com')
      const books = Object.fromEntries(profile.history.map((entry) => [entry.bookId, entry]))
      expect(books[SALT]).toMatchObject({ clubId: THURSDAY, isCurrent: true, checkpointIndex: 1 })
      expect(books[GLASS]).toMatchObject({
        clubId: HARBOUR,
        isCurrent: false,
        checkpointLabel: 'Epilogue',
        checkpointCount: 4,
      })
      expect(profile.ownedClubs.map((club) => club.id)).toEqual([HARBOUR])
      // Seeded Sam and Riley, plus people who joined in earlier tests.
      expect(profile.ownedClubs[0]!.otherMemberCount).toBeGreaterThanOrEqual(2)
    })

    it('renames the account', async () => {
      const { client } = await newUser('Old Name')
      const { account } = await json<{ account: Account }>(
        client.request('/api/account', { method: 'PATCH', body: { name: 'New Name' } }),
      )
      expect(account.name).toBe('New Name')
      expect(
        (await client.request('/api/account', { method: 'PATCH', body: { name: ' ' } })).status,
      ).toBe(400)
    })

    it('changes the email only with the current password', async () => {
      const { client, email } = await newUser('Mover')
      const change = (password: string, newEmail: string) =>
        client.request('/api/account/email', { method: 'PUT', body: { email: newEmail, password } })
      expect((await change('wrong-password', 'moved@test.example')).status).toBe(403)
      expect((await change('a-long-password', 'maya@example.com')).status).toBe(409)
      expect((await change('a-long-password', 'Moved@Test.Example')).status).toBe(200)
      expect(
        (await createClient(baseUrl).login('moved@test.example', 'a-long-password')).status,
      ).toBe(200)
      expect((await createClient(baseUrl).login(email, 'a-long-password')).status).toBe(401)
    })

    it('deletes the account: owners hand over shared clubs first, posts stay', async () => {
      const { client: owner, account, email } = await newUser('Departing')
      const shared = await createClub(owner, 'Shared')
      const solo = await createClub(owner, 'Solo')
      const { client: member, account: memberAccount } = await newUser('Stays')
      await join(member, (await detail(owner, shared.id)).inviteCode)
      await owner.request(`${bookPath(shared.id, shared.currentBook!.id)}/threads`, {
        method: 'POST',
        body: { title: 'Last words', body: 'Keep reading!' },
      })

      const remove = (password: string) =>
        owner.request('/api/account', { method: 'DELETE', body: { password } })
      expect((await remove('wrong-password')).status).toBe(403)
      expect((await remove('a-long-password')).status).toBe(409)

      await owner.request(`/api/clubs/${shared.id}/owner`, {
        method: 'POST',
        body: { memberId: memberAccount.id },
      })
      expect((await remove('a-long-password')).status).toBe(204)
      expect((await owner.request('/api/auth/me')).status).toBe(401)
      expect((await createClient(baseUrl).login(email, 'a-long-password')).status).toBe(401)

      // The solo club is gone; the shared club keeps the thread, author no longer listed.
      expect((await member.request(`/api/clubs/${solo.id}`)).status).toBe(404)
      const threads = (await discussion(member, shared.id, shared.currentBook!.id)).threads
      expect(threads.map((t) => [t.title, t.authorId])).toEqual([['Last words', account.id]])
      const club = await detail(member, shared.id)
      expect(club.members.map((m) => m.id)).toEqual([memberAccount.id])
    })
  })

  describe('request hygiene', () => {
    it('hides clubs the member does not belong to', async () => {
      const { client } = await newUser('Outsider')
      for (const path of [
        `/api/clubs/${THURSDAY}`,
        bookPath(THURSDAY, SALT),
        `${bookPath(THURSDAY, SALT)}/discussion`,
      ]) {
        expect((await client.request(path)).status).toBe(404)
      }
      const write = await client.request(`${bookPath(THURSDAY, SALT)}/threads`, {
        method: 'POST',
        body: { title: 'Hi', body: 'There' },
      })
      expect(write.status).toBe(404)
    })

    it('rejects writes that are not JSON (CSRF guard)', async () => {
      const maya = await signedIn('maya@example.com')
      const response = await maya.request(`${bookPath(THURSDAY, SALT)}/threads`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      })
      expect(response.status).toBe(415)
    })

    it('marks API responses as uncacheable', async () => {
      const response = await createClient(baseUrl).request('/api/health')
      expect(response.headers.get('cache-control')).toBe('no-store')
    })

    it('returns JSON 404 for unknown API routes', async () => {
      const response = await createClient(baseUrl).request('/api/unknown')
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Not found.' })
    })
  })
})
