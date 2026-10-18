import type { Reply, Thread } from './types.js'

/**
 * The visibility rule — the single source of truth for spoiler filtering.
 *
 *   post.checkpointIndex <= currentMember.checkpointIndex
 *
 * Applies equally to threads and replies. Every read path that shows
 * discussion must go through `buildVisibleFeed` (or this function) rather
 * than re-implementing the comparison.
 *
 * MVP limitation: in the prototype this filter runs in the browser on data
 * the client has already received, and progress is self-reported. It is a
 * product demonstration, NOT a security boundary. A production version must
 * apply this rule on the server before returning any post data.
 */
export function isVisibleAt(itemCheckpointIndex: number, readerCheckpointIndex: number): boolean {
  return itemCheckpointIndex <= readerCheckpointIndex
}

/**
 * A thread as a reader at a given checkpoint may see it. Hidden replies are
 * reduced to a count: no body, author, timestamp or other preview survives.
 */
export interface VisibleThread {
  id: string
  authorId: string
  title: string
  body: string
  checkpointIndex: number
  createdAt: string
  replies: Reply[]
  hiddenReplyCount: number
  /** Latest timestamp among the thread and its *visible* replies only. */
  lastActivityAt: string
}

export const HIDDEN_REPLIES_MESSAGE = 'Some replies are hidden until you reach a later checkpoint.'

const byCreatedAt = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt.localeCompare(b.createdAt)

/**
 * Filter a discussion for a reader. Threads above the reader's checkpoint are
 * dropped entirely; visible threads keep only visible replies plus a count of
 * hidden ones. Sorted by most recent visible activity.
 */
export function buildVisibleFeed(
  threads: readonly Thread[],
  readerCheckpointIndex: number,
): VisibleThread[] {
  return threads
    .filter((thread) => isVisibleAt(thread.checkpointIndex, readerCheckpointIndex))
    .map((thread): VisibleThread => {
      const replies = thread.replies
        .filter((reply) => isVisibleAt(reply.checkpointIndex, readerCheckpointIndex))
        .sort(byCreatedAt)
      const lastReply = replies.at(-1)
      return {
        id: thread.id,
        authorId: thread.authorId,
        title: thread.title,
        body: thread.body,
        checkpointIndex: thread.checkpointIndex,
        createdAt: thread.createdAt,
        replies,
        hiddenReplyCount: thread.replies.length - replies.length,
        lastActivityAt: lastReply ? lastReply.createdAt : thread.createdAt,
      }
    })
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
}
