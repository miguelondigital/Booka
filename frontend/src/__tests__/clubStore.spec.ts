import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { saltOrchard } from '@shared/fixtures'
import type { BookOverview, ClubDetail, Discussion, NewThreadInput } from '@shared/types'
import { buildVisibleFeed } from '@shared/visibility'
import { api } from '@/data/api'
import { useClubStore } from '@/stores/club'

vi.mock('@/data/api', () => ({
  api: {
    clubDetail: vi.fn(),
    book: vi.fn(),
    discussion: vi.fn(),
    updateProgress: vi.fn(),
    createThread: vi.fn(),
    createReply: vi.fn(),
  },
}))

const mocked = vi.mocked(api)
const clubId = 'club-thursday-readers'
const bookId = saltOrchard.book.id
const club = { id: clubId, name: 'Thursday Night Readers' }

/** What the server would send Maya (checkpoint 1). */
const discussionAt = (index: number): Discussion => ({
  readerCheckpointIndex: index,
  threads: buildVisibleFeed(saltOrchard.threads, index),
})

const summary = (id: string, isCurrent: boolean) => ({
  ...saltOrchard.book,
  id,
  startedAt: saltOrchard.startedAt,
  isCurrent,
  checkpointCount: saltOrchard.checkpoints.length,
})

const detail = (): ClubDetail => ({
  club,
  isOwner: false,
  ownerId: 'member-riley',
  inviteCode: 'SALTORCH01',
  books: [summary(bookId, true), summary('book-older', false)],
  members: [],
  blocked: [],
})

const overview = (): BookOverview => {
  const members = Object.entries(saltOrchard.progress).map(([id, checkpointIndex]) => ({
    id,
    name: id.replace('member-', ''),
    checkpointIndex,
  }))
  return {
    club,
    book: summary(bookId, true),
    checkpoints: structuredClone(saltOrchard.checkpoints),
    members,
    me: members[0]!,
  }
}

async function readyStore() {
  mocked.clubDetail.mockResolvedValue(detail())
  mocked.book.mockResolvedValue(overview())
  mocked.discussion.mockResolvedValue(discussionAt(1))
  const store = useClubStore()
  await store.load(clubId)
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('club store', () => {
  it("loads the club's current book and its server-filtered discussion", async () => {
    const store = await readyStore()
    expect(mocked.book).toHaveBeenCalledWith(clubId, bookId)
    expect(mocked.discussion).toHaveBeenCalledWith(clubId, bookId)
    expect(store.status).toBe('ready')
    expect(store.books).toHaveLength(2)
    expect(store.currentBook?.id).toBe(bookId)
    expect(store.me?.name).toBe('maya')
    expect(store.myCheckpoint?.label).toBe('Chapters 3-4')
    expect(store.feed.map((thread) => thread.id).sort()).toEqual([
      'thread-cedar-chest',
      'thread-first-impressions',
    ])
  })

  it('loads a specific (past) book when asked', async () => {
    mocked.clubDetail.mockResolvedValue(detail())
    mocked.book.mockResolvedValue(overview())
    mocked.discussion.mockResolvedValue(discussionAt(1))
    await useClubStore().load(clubId, 'book-older')
    expect(mocked.book).toHaveBeenCalledWith(clubId, 'book-older')
  })

  it('reports load failures', async () => {
    mocked.clubDetail.mockRejectedValue(new Error('Club not found.'))
    mocked.discussion.mockResolvedValue(discussionAt(1))
    const store = useClubStore()
    await store.load('missing')
    expect(store.status).toBe('error')
    expect(store.loadError).toBe('Club not found.')
  })

  it('replaces the feed with the discussion returned by a progress change', async () => {
    const store = await readyStore()
    mocked.updateProgress.mockResolvedValue({
      me: { id: 'member-maya', name: 'Maya', checkpointIndex: 3 },
      discussion: discussionAt(3),
    })
    const pending = store.setCheckpoint(3)
    expect(store.updatingProgress).toBe(true)
    await pending
    expect(store.updatingProgress).toBe(false)
    expect(mocked.updateProgress).toHaveBeenCalledWith(clubId, bookId, 3)
    expect(store.me?.checkpointIndex).toBe(3)
    expect(store.members.find((member) => member.id === 'member-maya')?.checkpointIndex).toBe(3)
    expect(store.feed).toHaveLength(4)
  })

  it('ignores a stale progress response when a newer one is in flight', async () => {
    const store = await readyStore()
    let resolveSlow!: (value: Awaited<ReturnType<typeof api.updateProgress>>) => void
    mocked.updateProgress
      .mockReturnValueOnce(new Promise((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce({
        me: { id: 'member-maya', name: 'Maya', checkpointIndex: 0 },
        discussion: discussionAt(0),
      })
    const slow = store.setCheckpoint(5)
    await store.setCheckpoint(0)
    resolveSlow({
      me: { id: 'member-maya', name: 'Maya', checkpointIndex: 5 },
      discussion: discussionAt(5),
    })
    await slow
    expect(store.me?.checkpointIndex).toBe(0)
    expect(store.feed.map((thread) => thread.id)).toEqual(['thread-first-impressions'])
  })

  it('sends only title and body for a new thread and shows the server result first', async () => {
    const store = await readyStore()
    mocked.createThread.mockImplementation(async (_clubId, _bookId, input: NewThreadInput) => ({
      id: 'thread-new',
      authorId: 'member-maya',
      title: input.title,
      body: input.body,
      checkpointIndex: 1,
      createdAt: '2026-10-18T12:00:00.000Z',
      replies: [],
      hiddenReplyCount: 0,
      lastActivityAt: '2026-10-18T12:00:00.000Z',
    }))
    await store.createThread({ title: 'Hello', body: 'World' })
    expect(mocked.createThread).toHaveBeenCalledWith(clubId, bookId, {
      title: 'Hello',
      body: 'World',
    })
    expect(store.feed[0]?.id).toBe('thread-new')
  })

  it('appends a reply to its thread', async () => {
    const store = await readyStore()
    mocked.createReply.mockResolvedValue({
      id: 'reply-new',
      threadId: 'thread-cedar-chest',
      authorId: 'member-maya',
      body: 'Me too',
      checkpointIndex: 1,
      createdAt: '2026-10-18T12:00:00.000Z',
    })
    await store.reply('thread-cedar-chest', { body: 'Me too' })
    const thread = store.feed.find((candidate) => candidate.id === 'thread-cedar-chest')!
    expect(thread.replies.at(-1)?.id).toBe('reply-new')
    expect(thread.lastActivityAt).toBe('2026-10-18T12:00:00.000Z')
  })
})
