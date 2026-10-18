import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import type { AppConfig } from '../src/config.js'
import { disconnectPrisma, getPrisma } from '../src/db/client.js'
import type { DemoPayload, Member, Reply, Thread } from '../../shared/types.js'
import { demoFixtures } from '../../shared/fixtures.js'

async function startServer(config: Partial<AppConfig>) {
  const app = createApp({
    port: 0,
    dataSource: 'demo',
    databaseUrl: undefined,
    clientDist: '/nonexistent',
    ...config,
  })
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening))
  })
  const { port } = server.address() as AddressInfo
  const request = (path: string, init: RequestInit = {}) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    })
  return { server, request }
}

describe('API in demo mode (DATA_SOURCE=demo)', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>
  beforeAll(async () => {
    ctx = await startServer({ dataSource: 'demo' })
  })
  afterAll(() => ctx.server.close())

  it('GET /api/health reports the server is running', async () => {
    const res = await ctx.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', dataSource: 'demo' })
  })

  it('GET /api/health/db reports a missing DATABASE_URL as 503', async () => {
    const res = await ctx.request('/api/health/db')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ database: 'not_configured' })
  })

  it('GET /api/demo returns the club, book, checkpoints, members and discussion fixtures', async () => {
    const res = await ctx.request('/api/demo')
    const payload = (await res.json()) as DemoPayload
    expect(payload.dataSource).toBe('demo')
    expect(payload.checkpoints.map((checkpoint) => checkpoint.label)).toEqual([
      'Chapters 1-2',
      'Chapters 3-4',
      'Chapters 5-6',
      'Chapters 7-8',
      'Chapters 9-10',
      'Ending',
    ])
    expect(payload.members.map((member) => [member.name, member.checkpointIndex])).toEqual([
      ['Maya', 1],
      ['Jordan', 3],
      ['Riley', 5],
    ])
    expect(payload.threads).toHaveLength(demoFixtures.threads.length)
  })

  it('GET /api/clubs/:id returns the club and active book', async () => {
    const res = await ctx.request(`/api/clubs/${demoFixtures.club.id}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ club: demoFixtures.club, book: demoFixtures.book })
    expect((await ctx.request('/api/clubs/nope')).status).toBe(404)
  })

  it('rejects server writes because demo writes live in the browser', async () => {
    const res = await ctx.request('/api/threads', {
      method: 'POST',
      headers: { 'x-member-id': 'member-maya' },
      body: JSON.stringify({ title: 'Hi', body: 'There' }),
    })
    expect(res.status).toBe(409)
  })

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await ctx.request('/api/unknown')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found.' })
  })
})

// Opt-in: TEST_DATABASE_URL=postgresql://... npm test -w backend
// Requires a migrated + seeded database. Rows created here are deleted afterwards.
const databaseUrl = process.env.TEST_DATABASE_URL
describe.skipIf(!databaseUrl)('API in DB mode (DATA_SOURCE=db)', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>
  let mayaStartIndex = 1
  const createdThreadIds: string[] = []
  const createdReplyIds: string[] = []
  const asMaya = { 'x-member-id': 'member-maya' }

  beforeAll(async () => {
    ctx = await startServer({ dataSource: 'db', databaseUrl })
    const payload = (await (await ctx.request('/api/demo')).json()) as DemoPayload
    mayaStartIndex = payload.members.find((member) => member.id === 'member-maya')!.checkpointIndex
  })

  afterAll(async () => {
    const prisma = getPrisma(databaseUrl!)
    await prisma.post.deleteMany({ where: { id: { in: createdReplyIds } } })
    await prisma.thread.deleteMany({ where: { id: { in: createdThreadIds } } })
    await ctx.request('/api/progress/me', {
      method: 'PUT',
      headers: asMaya,
      body: JSON.stringify({ checkpointIndex: mayaStartIndex }),
    })
    ctx.server.close()
    await disconnectPrisma()
  })

  it('GET /api/health/db confirms Prisma can reach PostgreSQL', async () => {
    const res = await ctx.request('/api/health/db')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ database: 'connected' })
  })

  it('GET /api/demo loads the seeded club from the database', async () => {
    const payload = (await (await ctx.request('/api/demo')).json()) as DemoPayload
    expect(payload.dataSource).toBe('db')
    expect(payload.club).toEqual(demoFixtures.club)
    expect(payload.checkpoints).toEqual(demoFixtures.checkpoints)
  })

  it("stamps a new thread with the author's progress and ignores a client-supplied checkpoint", async () => {
    await ctx.request('/api/progress/me', {
      method: 'PUT',
      headers: asMaya,
      body: JSON.stringify({ checkpointIndex: 2 }),
    })
    const res = await ctx.request('/api/threads', {
      method: 'POST',
      headers: asMaya,
      body: JSON.stringify({ title: 'Test thread', body: 'Test body', checkpointIndex: 5 }),
    })
    expect(res.status).toBe(201)
    const thread = (await res.json()) as Thread
    createdThreadIds.push(thread.id)
    expect(thread.checkpointIndex).toBe(2)
  })

  it('stamps replies with the author progress', async () => {
    const res = await ctx.request('/api/threads/thread-first-impressions/posts', {
      method: 'POST',
      headers: asMaya,
      body: JSON.stringify({ body: 'Test reply', checkpointIndex: 0 }),
    })
    expect(res.status).toBe(201)
    const reply = (await res.json()) as Reply
    createdReplyIds.push(reply.id)
    expect(reply.checkpointIndex).toBe(2)
  })

  it('does not let a member reply to a thread beyond their checkpoint', async () => {
    const res = await ctx.request('/api/threads/thread-ending/posts', {
      method: 'POST',
      headers: asMaya,
      body: JSON.stringify({ body: 'Sneaky' }),
    })
    expect(res.status).toBe(404)
  })

  it('validates progress updates and identity', async () => {
    const outOfRange = await ctx.request('/api/progress/me', {
      method: 'PUT',
      headers: asMaya,
      body: JSON.stringify({ checkpointIndex: 99 }),
    })
    expect(outOfRange.status).toBe(400)
    const anonymous = await ctx.request('/api/progress/me', {
      method: 'PUT',
      body: JSON.stringify({ checkpointIndex: 1 }),
    })
    expect(anonymous.status).toBe(400)
    const ok = await ctx.request('/api/progress/me', {
      method: 'PUT',
      headers: asMaya,
      body: JSON.stringify({ checkpointIndex: 3 }),
    })
    expect(((await ok.json()) as Member).checkpointIndex).toBe(3)
  })
})
