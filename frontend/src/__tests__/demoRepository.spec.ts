import { beforeEach, describe, expect, it } from 'vitest'
import { demoFixtures } from '@shared/fixtures'
import type { NewThreadInput } from '@shared/types'
import { createDemoRepository, demoStorageKey } from '@/data/demoRepository'
import { createMemoryStorage, type StorageLike } from '@/data/storage'

let storage: StorageLike
const open = () => createDemoRepository(demoFixtures, storage)

beforeEach(() => {
  storage = createMemoryStorage()
})

describe('demo repository', () => {
  it("stamps a new thread with the author's current checkpoint", async () => {
    const thread = await open().createThread('member-maya', { title: 'Hello', body: 'World' })
    expect(thread.checkpointIndex).toBe(1)
  })

  it('ignores any checkpoint the caller tries to supply', async () => {
    const sneaky = { title: 'Hello', body: 'World', checkpointIndex: 5 } as NewThreadInput
    const thread = await open().createThread('member-maya', sneaky)
    expect(thread.checkpointIndex).toBe(1)
  })

  it('stamps posts from the progress at the time of posting', async () => {
    const repository = open()
    await repository.updateProgress('member-maya', 3)
    const reply = await repository.createReply('member-maya', 'thread-marian', { body: 'Wow' })
    expect(reply.checkpointIndex).toBe(3)
  })

  it('refuses replies to threads beyond the author checkpoint', async () => {
    await expect(
      open().createReply('member-maya', 'thread-ending', { body: 'Sneaky' }),
    ).rejects.toThrow('Thread not found.')
  })

  it('validates input and checkpoint range', async () => {
    const repository = open()
    await expect(
      repository.createThread('member-maya', { title: ' ', body: 'x' }),
    ).rejects.toThrow()
    await expect(
      repository.createReply('member-maya', 'thread-cedar-chest', { body: '' }),
    ).rejects.toThrow()
    await expect(repository.updateProgress('member-maya', 6)).rejects.toThrow()
    await expect(repository.updateProgress('member-maya', -1)).rejects.toThrow()
  })

  it('keeps progress and new posts across a refresh', async () => {
    const first = open()
    await first.updateProgress('member-jordan', 4)
    const thread = await first.createThread('member-jordan', { title: 'New', body: 'Thread' })
    const reply = await first.createReply('member-riley', 'thread-cedar-chest', { body: 'Reply' })

    const snapshot = await open().load()
    expect(snapshot.members.find((member) => member.id === 'member-jordan')!.checkpointIndex).toBe(
      4,
    )
    expect(snapshot.threads.some((candidate) => candidate.id === thread.id)).toBe(true)
    const cedar = snapshot.threads.find((candidate) => candidate.id === 'thread-cedar-chest')!
    expect(cedar.replies.map((candidate) => candidate.id)).toContain(reply.id)
  })

  it('does not mutate the shared fixtures', async () => {
    const before = JSON.stringify(demoFixtures)
    const repository = open()
    await repository.createReply('member-riley', 'thread-ending', { body: 'Reply' })
    await repository.load()
    expect(JSON.stringify(demoFixtures)).toBe(before)
  })

  it('falls back to fixtures when saved data is corrupt', async () => {
    storage.setItem(demoStorageKey(demoFixtures), '{not json')
    const snapshot = await open().load()
    expect(snapshot.members.map((member) => member.checkpointIndex)).toEqual([1, 3, 5])
  })

  it('reset restores the fixtures', async () => {
    const repository = open()
    await repository.updateProgress('member-maya', 5)
    await repository.createThread('member-maya', { title: 'New', body: 'Thread' })
    await repository.reset!()
    const snapshot = await open().load()
    expect(snapshot.members[0]!.checkpointIndex).toBe(1)
    expect(snapshot.threads).toHaveLength(demoFixtures.threads.length)
  })
})
