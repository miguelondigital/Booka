import { describe, expect, it } from 'vitest'
import { demoFixtures } from '@shared/fixtures'
import { buildVisibleFeed, isVisibleAt } from '@shared/visibility'

/** Acceptance tests from the MVP spec, run against the seeded demo fixtures. */

const allReplies = demoFixtures.threads.flatMap((thread) => thread.replies)
const visibleCheckpoints = (readerIndex: number) => {
  const feed = buildVisibleFeed(demoFixtures.threads, readerIndex)
  return new Set([
    ...feed.map((thread) => thread.checkpointIndex),
    ...feed.flatMap((thread) => thread.replies.map((reply) => reply.checkpointIndex)),
  ])
}

describe('isVisibleAt (post.checkpointIndex <= member.checkpointIndex)', () => {
  it('shows items at or before the reader checkpoint and hides later ones', () => {
    expect(isVisibleAt(0, 3)).toBe(true)
    expect(isVisibleAt(3, 3)).toBe(true)
    expect(isVisibleAt(4, 3)).toBe(false)
  })
})

describe('buildVisibleFeed acceptance matrix', () => {
  it('member at checkpoint 1 cannot see posts or replies from checkpoints 2 through 5', () => {
    const feed = buildVisibleFeed(demoFixtures.threads, 1)
    expect([...visibleCheckpoints(1)].every((index) => index <= 1)).toBe(true)
    expect(feed.map((thread) => thread.id).sort()).toEqual([
      'thread-cedar-chest',
      'thread-first-impressions',
    ])
  })

  it('member at checkpoint 3 can see posts and replies from checkpoints 0 through 3', () => {
    expect([...visibleCheckpoints(3)].sort()).toEqual([0, 1, 2, 3])
    const feed = buildVisibleFeed(demoFixtures.threads, 3)
    const visibleReplyIds = new Set(
      feed.flatMap((thread) => thread.replies.map((reply) => reply.id)),
    )
    for (const reply of allReplies) {
      expect(visibleReplyIds.has(reply.id)).toBe(reply.checkpointIndex <= 3)
    }
  })

  it('member at checkpoint 5 can see all seeded posts and replies', () => {
    const feed = buildVisibleFeed(demoFixtures.threads, 5)
    expect(feed).toHaveLength(demoFixtures.threads.length)
    expect(feed.flatMap((thread) => thread.replies)).toHaveLength(allReplies.length)
    expect(feed.every((thread) => thread.hiddenReplyCount === 0)).toBe(true)
  })

  it('keeps a visible thread but reduces future replies to a count', () => {
    const thread = buildVisibleFeed(demoFixtures.threads, 1).find(
      (candidate) => candidate.id === 'thread-first-impressions',
    )!
    expect(thread.replies.map((reply) => reply.id)).toEqual(['reply-first-impressions-1'])
    expect(thread.hiddenReplyCount).toBe(2)
  })

  it('leaks no hidden body, title, author, id or activity time', () => {
    for (const readerIndex of [0, 1, 2, 3, 4]) {
      const serialized = JSON.stringify(buildVisibleFeed(demoFixtures.threads, readerIndex))
      const hiddenThreads = demoFixtures.threads.filter(
        (thread) => thread.checkpointIndex > readerIndex,
      )
      const hiddenReplies = allReplies.filter((reply) => reply.checkpointIndex > readerIndex)
      for (const thread of hiddenThreads) {
        expect(serialized).not.toContain(thread.id)
        expect(serialized).not.toContain(thread.title)
        expect(serialized).not.toContain(thread.body)
        expect(serialized).not.toContain(thread.createdAt)
      }
      for (const reply of hiddenReplies) {
        expect(serialized).not.toContain(reply.id)
        expect(serialized).not.toContain(reply.body)
        expect(serialized).not.toContain(reply.createdAt)
      }
    }
  })

  it('orders threads by latest visible activity only', () => {
    const feed = buildVisibleFeed(demoFixtures.threads, 1)
    // first-impressions has later replies (Oct 5, Oct 9) but they are hidden at
    // checkpoint 1, so cedar-chest (visible reply Oct 3 19:01) is more recent.
    expect(feed.map((thread) => thread.id)).toEqual([
      'thread-cedar-chest',
      'thread-first-impressions',
    ])
    expect(feed[1]!.lastActivityAt).toBe('2026-10-02T09:40:00.000Z')
  })
})
