import type { ClubSnapshot, Member, Reply, Thread } from '@shared/types'
import { isCheckpointIndex, validateReplyInput, validateThreadInput } from '@shared/validation'
import { isVisibleAt } from '@shared/visibility'
import type { ClubRepository } from './repository'
import type { StorageLike } from './storage'

/** What the demo saves in the browser on top of the server fixtures. */
interface DemoState {
  version: 1
  progress: Record<string, number>
  threads: Thread[]
  replies: Reply[]
}

const emptyState = (): DemoState => ({ version: 1, progress: {}, threads: [], replies: [] })

export const demoStorageKey = (fixtures: ClubSnapshot) => `booka.demo.v1.${fixtures.book.id}`

interface DemoOptions {
  now?: () => Date
  newId?: (prefix: string) => string
}

/**
 * DATA_SOURCE=demo: read fixtures from the server, keep progress changes and
 * new posts in localStorage so they survive a refresh.
 */
export function createDemoRepository(
  fixtures: ClubSnapshot,
  storage: StorageLike,
  {
    now = () => new Date(),
    newId = (prefix) => `${prefix}-${crypto.randomUUID()}`,
  }: DemoOptions = {},
): ClubRepository {
  const key = demoStorageKey(fixtures)
  const checkpointCount = fixtures.checkpoints.length
  let state = readState()

  function readState(): DemoState {
    try {
      const raw = storage.getItem(key)
      if (!raw) return emptyState()
      const parsed = JSON.parse(raw) as Partial<DemoState>
      if (parsed.version !== 1) return emptyState()
      return {
        version: 1,
        progress: typeof parsed.progress === 'object' && parsed.progress ? parsed.progress : {},
        threads: Array.isArray(parsed.threads) ? parsed.threads : [],
        replies: Array.isArray(parsed.replies) ? parsed.replies : [],
      }
    } catch {
      // Corrupt or unreadable storage: fall back to the fixtures.
      return emptyState()
    }
  }

  function save() {
    try {
      storage.setItem(key, JSON.stringify(state))
    } catch {
      // Storage full or blocked: keep the in-memory state for this session.
    }
  }

  function findMember(memberId: string): Member {
    const member = fixtures.members.find((candidate) => candidate.id === memberId)
    if (!member) throw new Error('Member not found.')
    const saved = state.progress[memberId]
    return {
      ...member,
      checkpointIndex: isCheckpointIndex(saved, checkpointCount) ? saved : member.checkpointIndex,
    }
  }

  function allThreads(): Thread[] {
    const threads = structuredClone([...fixtures.threads, ...state.threads])
    const byId = new Map(threads.map((thread) => [thread.id, thread]))
    for (const reply of structuredClone(state.replies))
      byId.get(reply.threadId)?.replies.push(reply)
    return threads
  }

  return {
    dataSource: 'demo',

    async load() {
      return {
        club: { ...fixtures.club },
        book: { ...fixtures.book },
        checkpoints: fixtures.checkpoints.map((checkpoint) => ({ ...checkpoint })),
        members: fixtures.members.map((member) => findMember(member.id)),
        threads: allThreads(),
      }
    },

    async updateProgress(memberId, checkpointIndex) {
      if (!isCheckpointIndex(checkpointIndex, checkpointCount)) {
        throw new Error('That checkpoint is not part of this book.')
      }
      findMember(memberId)
      state.progress[memberId] = checkpointIndex
      save()
      return findMember(memberId)
    },

    async createThread(authorId, input) {
      const error = validateThreadInput(input)
      if (error) throw new Error(error)
      const author = findMember(authorId)
      const thread: Thread = {
        id: newId('thread'),
        authorId,
        title: input.title.trim(),
        body: input.body.trim(),
        // Stamped from the author's current progress — never from the input.
        checkpointIndex: author.checkpointIndex,
        createdAt: now().toISOString(),
        replies: [],
      }
      state.threads.push(thread)
      save()
      return structuredClone(thread)
    },

    async createReply(authorId, threadId, input) {
      const error = validateReplyInput(input)
      if (error) throw new Error(error)
      const author = findMember(authorId)
      const thread = allThreads().find((candidate) => candidate.id === threadId)
      if (!thread || !isVisibleAt(thread.checkpointIndex, author.checkpointIndex)) {
        throw new Error('Thread not found.')
      }
      const reply: Reply = {
        id: newId('reply'),
        threadId,
        authorId,
        body: input.body.trim(),
        checkpointIndex: author.checkpointIndex,
        createdAt: now().toISOString(),
      }
      state.replies.push(reply)
      save()
      return structuredClone(reply)
    },

    async reset() {
      state = emptyState()
      try {
        storage.removeItem(key)
      } catch {
        // Nothing persisted to clear.
      }
    },
  }
}
