import type {
  ClubSnapshot,
  DataSource,
  DemoPayload,
  Member,
  NewReplyInput,
  NewThreadInput,
  Reply,
  Thread,
} from '@shared/types'
import { createApiRepository } from './apiRepository'
import { createDemoRepository } from './demoRepository'
import { requestJson } from './http'
import { browserStorage } from './storage'

/**
 * The client's data boundary. Components and the store only talk to this
 * interface, so the demo (localStorage) implementation can be swapped for the
 * API/Prisma-backed one without touching any component.
 *
 * Writes take the acting member; implementations stamp new threads and
 * replies with that member's current checkpoint. There is no way for a caller
 * to choose a checkpoint.
 */
export interface ClubRepository {
  readonly dataSource: DataSource
  load(): Promise<ClubSnapshot>
  updateProgress(memberId: string, checkpointIndex: number): Promise<Member>
  createThread(authorId: string, input: NewThreadInput): Promise<Thread>
  createReply(authorId: string, threadId: string, input: NewReplyInput): Promise<Reply>
  /** Demo only: discard progress and posts saved in this browser. */
  reset?(): Promise<void>
}

export interface Connection {
  repository: ClubRepository
  snapshot: ClubSnapshot
}

/** Ask the server which data mode it runs in and build the matching repository. */
export async function connectRepository(): Promise<Connection> {
  const { dataSource, ...fixtures } = await requestJson<DemoPayload>('/api/demo')
  if (dataSource === 'db') {
    return { repository: createApiRepository(), snapshot: fixtures }
  }
  const repository = createDemoRepository(fixtures, browserStorage())
  return { repository, snapshot: await repository.load() }
}
