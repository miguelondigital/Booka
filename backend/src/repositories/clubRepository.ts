import type {
  Book,
  Checkpoint,
  Club,
  ClubSnapshot,
  Member,
  NewReplyInput,
  NewThreadInput,
  Reply,
  Thread,
} from '../../../shared/types.js'

/**
 * Data boundary for the API. `fixtureRepository` (DATA_SOURCE=demo) and
 * `prismaRepository` (DATA_SOURCE=db) implement the same contract.
 *
 * Write methods take the acting member and stamp the new thread/reply with
 * that member's current checkpoint. Callers can never choose the checkpoint.
 */
export interface ClubRepository {
  getSnapshot(): Promise<ClubSnapshot>
  getClub(clubId: string): Promise<{ club: Club; book: Book; checkpoints: Checkpoint[] }>
  updateProgress(memberId: string, checkpointIndex: number): Promise<Member>
  createThread(memberId: string, input: NewThreadInput): Promise<Thread>
  createReply(memberId: string, threadId: string, input: NewReplyInput): Promise<Reply>
}
