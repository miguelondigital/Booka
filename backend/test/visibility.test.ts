import { describe, expect, it } from 'vitest'
import { saltOrchard } from '../../shared/fixtures.js'
import { suggestCheckpoints } from '../../shared/checkpoints.js'
import { buildVisibleFeed, isVisibleAt } from '../../shared/visibility.js'

/** The spec's acceptance matrix, against the seeded fixtures. */

const allReplies = saltOrchard.threads.flatMap((thread) => thread.replies)
const visibleCheckpoints = (readerIndex: number) => {
  const feed = buildVisibleFeed(saltOrchard.threads, readerIndex)
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
    expect([...visibleCheckpoints(1)].every((index) => index <= 1)).toBe(true)
    expect(
      buildVisibleFeed(saltOrchard.threads, 1)
        .map((thread) => thread.id)
        .sort(),
    ).toEqual(['thread-cedar-chest', 'thread-first-impressions'])
  })

  it('member at checkpoint 3 can see posts and replies from checkpoints 0 through 3', () => {
    expect([...visibleCheckpoints(3)].sort()).toEqual([0, 1, 2, 3])
    const visibleReplyIds = new Set(
      buildVisibleFeed(saltOrchard.threads, 3).flatMap((thread) =>
        thread.replies.map((reply) => reply.id),
      ),
    )
    for (const reply of allReplies) {
      expect(visibleReplyIds.has(reply.id)).toBe(reply.checkpointIndex <= 3)
    }
  })

  it('member at checkpoint 5 can see all seeded posts and replies', () => {
    const feed = buildVisibleFeed(saltOrchard.threads, 5)
    expect(feed).toHaveLength(saltOrchard.threads.length)
    expect(feed.flatMap((thread) => thread.replies)).toHaveLength(allReplies.length)
    expect(feed.every((thread) => thread.hiddenReplyCount === 0)).toBe(true)
  })

  it('keeps a visible thread but reduces future replies to a count', () => {
    const thread = buildVisibleFeed(saltOrchard.threads, 1).find(
      (candidate) => candidate.id === 'thread-first-impressions',
    )!
    expect(thread.replies.map((reply) => reply.id)).toEqual(['reply-first-impressions-1'])
    expect(thread.hiddenReplyCount).toBe(2)
  })

  it('leaks no hidden body, title, author, id or activity time', () => {
    for (const readerIndex of [0, 1, 2, 3, 4]) {
      const serialized = JSON.stringify(buildVisibleFeed(saltOrchard.threads, readerIndex))
      for (const thread of saltOrchard.threads.filter((t) => t.checkpointIndex > readerIndex)) {
        expect(serialized).not.toContain(thread.id)
        expect(serialized).not.toContain(thread.title)
        expect(serialized).not.toContain(thread.body)
        expect(serialized).not.toContain(thread.createdAt)
      }
      for (const reply of allReplies.filter((r) => r.checkpointIndex > readerIndex)) {
        expect(serialized).not.toContain(reply.id)
        expect(serialized).not.toContain(reply.body)
        expect(serialized).not.toContain(reply.createdAt)
      }
    }
  })

  it('orders threads by latest visible activity only', () => {
    const feed = buildVisibleFeed(saltOrchard.threads, 1)
    // first-impressions has later replies (Oct 5, Oct 9) but they are hidden at
    // checkpoint 1, so cedar-chest (visible reply Oct 3 19:01) is more recent.
    expect(feed.map((thread) => thread.id)).toEqual([
      'thread-cedar-chest',
      'thread-first-impressions',
    ])
    expect(feed[1]!.lastActivityAt).toBe('2026-10-02T09:40:00.000Z')
  })
})

describe('suggestCheckpoints', () => {
  it('groups chapters and ends with "Ending"', () => {
    expect(suggestCheckpoints(10, 2)).toEqual([
      'Chapters 1-2',
      'Chapters 3-4',
      'Chapters 5-6',
      'Chapters 7-8',
      'Chapters 9-10',
      'Ending',
    ])
    expect(suggestCheckpoints(7, 3)).toEqual([
      'Chapters 1-3',
      'Chapters 4-6',
      'Chapter 7',
      'Ending',
    ])
    expect(suggestCheckpoints(0)).toEqual(['Ending'])
  })
})
