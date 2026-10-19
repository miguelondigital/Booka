import type { Thread, VisibleThread } from './types.js'

export type { VisibleThread }

/**
 * The visibility rule — the single source of truth for spoiler filtering.
 *
 *   post.checkpointIndex <= currentMember.checkpointIndex
 *
 * Applies equally to threads and replies. Every read path that shows
 * discussion must go through `buildVisibleFeed` (or this function) rather
 * than re-implementing the comparison.
 *
 * Enforcement: the API applies this on the server before any discussion
 * leaves it (see backend/src/services/discussion.ts). Clients only ever
 * receive the filtered result, so hidden content never reaches the browser.
 */
export function isVisibleAt(itemCheckpointIndex: number, readerCheckpointIndex: number): boolean {
  return itemCheckpointIndex <= readerCheckpointIndex
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
