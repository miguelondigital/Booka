import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { demoFixtures } from '@shared/fixtures'
import { createDemoRepository } from '@/data/demoRepository'
import { createMemoryStorage } from '@/data/storage'
import { useClubStore } from '@/stores/club'

async function readyStore() {
  const store = useClubStore()
  const repository = createDemoRepository(demoFixtures, createMemoryStorage())
  await store.init(async () => ({ repository, snapshot: await repository.load() }))
  return store
}

const ids = (store: ReturnType<typeof useClubStore>) =>
  store.visibleFeed.map((thread) => thread.id).sort()

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('club store', () => {
  it('starts with the first seeded member and a filtered feed', async () => {
    const store = await readyStore()
    expect(store.status).toBe('ready')
    expect(store.activeMember?.name).toBe('Maya')
    expect(ids(store)).toEqual(['thread-cedar-chest', 'thread-first-impressions'])
  })

  it('switching members changes what the feed shows', async () => {
    const store = await readyStore()
    store.selectMember('member-riley')
    expect(store.visibleFeed).toHaveLength(demoFixtures.threads.length)
    store.selectMember('member-jordan')
    expect(store.visibleFeed).toHaveLength(4)
  })

  it('updates the visible feed immediately when progress changes', async () => {
    const store = await readyStore()
    const pending = store.setCheckpoint(2)
    // Before the repository call resolves the feed already reflects checkpoint 2.
    expect(ids(store)).toContain('thread-tobias')
    await pending
    expect(store.activeMember?.checkpointIndex).toBe(2)
    await store.setCheckpoint(0)
    expect(ids(store)).toEqual(['thread-first-impressions'])
  })

  it('new threads are stamped with the author checkpoint and hidden from readers behind it', async () => {
    const store = await readyStore()
    store.selectMember('member-jordan')
    const thread = await store.createThread({ title: 'Chapter 8 twist', body: 'Spoilers!' })
    expect(thread.checkpointIndex).toBe(3)
    expect(store.visibleFeed[0]?.id).toBe(thread.id)

    store.selectMember('member-maya')
    expect(ids(store)).not.toContain(thread.id)
  })

  it('a reply from a later checkpoint shows up only as a hidden count', async () => {
    const store = await readyStore()
    store.selectMember('member-riley')
    await store.reply('thread-cedar-chest', { body: 'Ending spoiler' })

    store.selectMember('member-maya')
    const cedar = store.visibleFeed.find((thread) => thread.id === 'thread-cedar-chest')!
    expect(cedar.hiddenReplyCount).toBe(2)
    expect(JSON.stringify(cedar)).not.toContain('Ending spoiler')
  })
})
