import type { DemoPayload, Member, Reply, Thread } from '@shared/types'
import { requestJson } from './http'
import type { ClubRepository } from './repository'

/** DATA_SOURCE=db: every read and write goes through Express + Prisma. */
export function createApiRepository(): ClubRepository {
  return {
    dataSource: 'db',

    async load() {
      const { dataSource: _dataSource, ...snapshot } = await requestJson<DemoPayload>('/api/demo')
      return snapshot
    },

    updateProgress(memberId, checkpointIndex) {
      return requestJson<Member>('/api/progress/me', {
        method: 'PUT',
        memberId,
        body: { checkpointIndex },
      })
    },

    // Only title and body are sent; the server stamps the checkpoint.
    createThread(authorId, { title, body }) {
      return requestJson<Thread>('/api/threads', {
        method: 'POST',
        memberId: authorId,
        body: { title, body },
      })
    },

    createReply(authorId, threadId, { body }) {
      return requestJson<Reply>(`/api/threads/${encodeURIComponent(threadId)}/posts`, {
        method: 'POST',
        memberId: authorId,
        body: { body },
      })
    },
  }
}
