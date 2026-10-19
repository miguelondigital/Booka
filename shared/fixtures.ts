import { suggestCheckpoints } from './checkpoints.js'
import type { Book, Checkpoint, Club, Thread } from './types.js'

/**
 * Predictable demo data, used by the idempotent seed (backend/src/db/seed.ts)
 * and by the tests. All books and authors are fictional, so the discussion can
 * contain real "spoilers" without spoiling a real book.
 *
 * Invariants: every thread/reply is stamped at or below its author's
 * checkpoint in that book, and every reply is at or above its thread's.
 */

export interface DemoMember {
  id: string
  name: string
  email: string
}

export interface DemoBook {
  book: Book
  startedAt: string
  checkpoints: Checkpoint[]
  /** memberId → checkpoint index */
  progress: Record<string, number>
  threads: Thread[]
}

export interface DemoClub {
  club: Club
  ownerId: string
  inviteCode: string
  memberIds: string[]
  /** Oldest first: the last one is the club's current book. */
  books: DemoBook[]
}

/** Demo accounts. They can sign in only when the seed runs with DEMO_PASSWORD. */
export const demoMembers: DemoMember[] = [
  { id: 'member-maya', name: 'Maya', email: 'maya@example.com' },
  { id: 'member-jordan', name: 'Jordan', email: 'jordan@example.com' },
  { id: 'member-riley', name: 'Riley', email: 'riley@example.com' },
  { id: 'member-sam', name: 'Sam', email: 'sam@example.com' },
]

const checkpointsFor = (bookId: string, labels: string[], ids?: string[]): Checkpoint[] =>
  labels.map((label, index) => ({ id: ids?.[index] ?? `${bookId}-cp-${index}`, index, label }))

export const saltOrchard: DemoBook = {
  book: { id: 'book-salt-orchard', title: 'The Salt Orchard', author: 'Imogen Hale' },
  startedAt: '2026-09-28T18:00:00.000Z',
  checkpoints: checkpointsFor(
    'book-salt-orchard',
    suggestCheckpoints(10, 2),
    [0, 1, 2, 3, 4, 5].map((index) => `checkpoint-${index}`),
  ),
  progress: { 'member-maya': 1, 'member-jordan': 3, 'member-riley': 5 },
  threads: [
    {
      id: 'thread-first-impressions',
      authorId: 'member-jordan',
      title: 'First impressions of Wren',
      body: 'Two chapters in and I already love how guarded Wren is. She treats the orchard like a debt she inherited rather than a gift. Anyone else get that vibe?',
      checkpointIndex: 0,
      createdAt: '2026-10-01T18:12:00.000Z',
      replies: [
        {
          id: 'reply-first-impressions-1',
          threadId: 'thread-first-impressions',
          authorId: 'member-maya',
          body: 'Yes! The scene where she counts the dead trees before she even unpacks said everything about her.',
          checkpointIndex: 0,
          createdAt: '2026-10-02T09:40:00.000Z',
        },
        {
          id: 'reply-first-impressions-2',
          threadId: 'thread-first-impressions',
          authorId: 'member-riley',
          body: 'Rereading this after the storm surge: her refusing to leave the house while the lower orchard floods makes her guardedness make so much more sense.',
          checkpointIndex: 2,
          createdAt: '2026-10-05T20:05:00.000Z',
        },
        {
          id: 'reply-first-impressions-3',
          threadId: 'thread-first-impressions',
          authorId: 'member-jordan',
          body: 'Coming back to this knowing who actually wrote the letters, her coldness toward Tobias reads completely differently.',
          checkpointIndex: 3,
          createdAt: '2026-10-09T21:30:00.000Z',
        },
      ],
    },
    {
      id: 'thread-cedar-chest',
      authorId: 'member-maya',
      title: 'Who is "M." in the cedar chest letters?',
      body: "I keep assuming the letters are Ada's old love letters, but the handwriting detail in chapter 4 makes me think otherwise. Theories?",
      checkpointIndex: 1,
      createdAt: '2026-10-03T17:22:00.000Z',
      replies: [
        {
          id: 'reply-cedar-chest-1',
          threadId: 'thread-cedar-chest',
          authorId: 'member-jordan',
          body: 'I noticed the handwriting too! And Elias went very quiet when Wren mentioned the chest.',
          checkpointIndex: 1,
          createdAt: '2026-10-03T19:01:00.000Z',
        },
        {
          id: 'reply-cedar-chest-2',
          threadId: 'thread-cedar-chest',
          authorId: 'member-riley',
          body: "Hold on to that handwriting detail. It is Marian's, and it pays off when Tobias finally admits he recognised it years ago.",
          checkpointIndex: 4,
          createdAt: '2026-10-11T08:15:00.000Z',
        },
      ],
    },
    {
      id: 'thread-tobias',
      authorId: 'member-riley',
      title: 'Is Tobias the villain?',
      body: "Him meeting Calloway behind Wren's back right after the storm felt like a betrayal. But he is also the only one being realistic about the money. Thoughts?",
      checkpointIndex: 2,
      createdAt: '2026-10-05T21:10:00.000Z',
      replies: [
        {
          id: 'reply-tobias-1',
          threadId: 'thread-tobias',
          authorId: 'member-jordan',
          body: 'I was firmly anti-Tobias until chapter 8. Now I think he was protecting Wren from something.',
          checkpointIndex: 3,
          createdAt: '2026-10-08T22:45:00.000Z',
        },
        {
          id: 'reply-tobias-2',
          threadId: 'thread-tobias',
          authorId: 'member-riley',
          body: "Final verdict after finishing: not a villain at all. Him tearing up Calloway's contract on the dock is my favourite scene in the book.",
          checkpointIndex: 5,
          createdAt: '2026-10-14T19:20:00.000Z',
        },
      ],
    },
    {
      id: 'thread-marian',
      authorId: 'member-jordan',
      title: 'Marian is alive?!',
      body: 'I had to put the book down. Ada kept those letters from Wren her whole life. Was that cruelty or protection?',
      checkpointIndex: 3,
      createdAt: '2026-10-09T22:02:00.000Z',
      replies: [
        {
          id: 'reply-marian-1',
          threadId: 'thread-marian',
          authorId: 'member-riley',
          body: "Protection, I think, even if Ada clearly didn't trust Wren to handle the truth.",
          checkpointIndex: 3,
          createdAt: '2026-10-10T07:55:00.000Z',
        },
        {
          id: 'reply-marian-2',
          threadId: 'thread-marian',
          authorId: 'member-riley',
          body: 'It gets more complicated once Tobias admits he knew Marian was on the mainland all along.',
          checkpointIndex: 4,
          createdAt: '2026-10-12T12:30:00.000Z',
        },
        {
          id: 'reply-marian-3',
          threadId: 'thread-marian',
          authorId: 'member-riley',
          body: 'The final chapter reframes Ada completely: the last letter is from Ada to Marian, never sent. Come back when you have finished!',
          checkpointIndex: 5,
          createdAt: '2026-10-15T21:48:00.000Z',
        },
      ],
    },
    {
      id: 'thread-calloway',
      authorId: 'member-riley',
      title: "Calloway's offer and Tobias's choice",
      body: 'Chapter 10 is where the book finally lets Tobias speak for himself. Did his reason for refusing the sale land for you?',
      checkpointIndex: 4,
      createdAt: '2026-10-12T13:05:00.000Z',
      replies: [],
    },
    {
      id: 'thread-ending',
      authorId: 'member-riley',
      title: 'The ending: did the grafting scene earn it?',
      body: 'Marian coming home for the grafting, the salt-tolerant rootstock, that last line about roots that remember the sea. I cried. Was it too neat?',
      checkpointIndex: 5,
      createdAt: '2026-10-15T22:10:00.000Z',
      replies: [],
    },
  ],
}

const glassCartographer: DemoBook = {
  book: {
    id: 'book-glass-cartographer',
    title: 'The Glass Cartographer',
    author: 'Tomas Wrenfield',
  },
  startedAt: '2026-08-01T18:00:00.000Z',
  checkpoints: checkpointsFor('book-glass-cartographer', [
    'Part One',
    'Part Two',
    'Part Three',
    'Epilogue',
  ]),
  // Riley stopped partway through; the past book still filters for them.
  progress: { 'member-maya': 3, 'member-sam': 3, 'member-riley': 1 },
  threads: [
    {
      id: 'thread-ilse-map',
      authorId: 'member-sam',
      title: "Is Ilse's map actually wrong?",
      body: 'The opening where Ilse redraws the coastline from memory: do we trust her?',
      checkpointIndex: 0,
      createdAt: '2026-08-03T19:00:00.000Z',
      replies: [
        {
          id: 'reply-ilse-map-1',
          threadId: 'thread-ilse-map',
          authorId: 'member-maya',
          body: 'After Part Two I trust her a lot less. The harbourmaster contradicts her twice.',
          checkpointIndex: 1,
          createdAt: '2026-08-09T20:10:00.000Z',
        },
        {
          id: 'reply-ilse-map-2',
          threadId: 'thread-ilse-map',
          authorId: 'member-maya',
          body: 'The epilogue proves the map was right all along: the coast moved, not her memory.',
          checkpointIndex: 3,
          createdAt: '2026-08-24T21:00:00.000Z',
        },
      ],
    },
    {
      id: 'thread-archive-flood',
      authorId: 'member-maya',
      title: 'The archive flood in Part Three',
      body: "The archive flooding felt like the book's real turning point. Everything Ilse drew is gone.",
      checkpointIndex: 2,
      createdAt: '2026-08-16T18:30:00.000Z',
      replies: [
        {
          id: 'reply-archive-flood-1',
          threadId: 'thread-archive-flood',
          authorId: 'member-sam',
          body: "And the epilogue's last page mirrors the flood perfectly, with the new map drawn in salt.",
          checkpointIndex: 3,
          createdAt: '2026-08-25T09:00:00.000Z',
        },
      ],
    },
    {
      id: 'thread-epilogue',
      authorId: 'member-sam',
      title: 'Epilogue: the cartographer was her mother?',
      body: "So the cartographer signing the old charts was Ilse's mother all along. Did anyone see it coming?",
      checkpointIndex: 3,
      createdAt: '2026-08-25T10:00:00.000Z',
      replies: [],
    },
  ],
}

const harrowFen: DemoBook = {
  book: { id: 'book-harrow-fen', title: 'Winter at Harrow Fen', author: 'Odile Marsh' },
  startedAt: '2026-10-05T18:00:00.000Z',
  checkpoints: checkpointsFor('book-harrow-fen', suggestCheckpoints(8, 2)),
  progress: { 'member-maya': 2, 'member-riley': 0, 'member-sam': 4 },
  threads: [
    {
      id: 'thread-fen-lamps',
      authorId: 'member-maya',
      title: 'Who keeps lighting the fen lamps?',
      body: 'Two chapters in and someone keeps lighting the lamps on the fen path every night. Theories?',
      checkpointIndex: 0,
      createdAt: '2026-10-06T19:00:00.000Z',
      replies: [
        {
          id: 'reply-fen-lamps-1',
          threadId: 'thread-fen-lamps',
          authorId: 'member-riley',
          body: 'My money is on the ferryman. He is far too calm about it.',
          checkpointIndex: 0,
          createdAt: '2026-10-07T08:00:00.000Z',
        },
        {
          id: 'reply-fen-lamps-2',
          threadId: 'thread-fen-lamps',
          authorId: 'member-sam',
          body: 'Not the ferryman. Keep an eye on the lamp-oil receipts in chapter 7.',
          checkpointIndex: 3,
          createdAt: '2026-10-12T21:00:00.000Z',
        },
        {
          id: 'reply-fen-lamps-3',
          threadId: 'thread-fen-lamps',
          authorId: 'member-sam',
          body: 'The ending recasts every lamp scene: it was Bea, signalling the boat she sank.',
          checkpointIndex: 4,
          createdAt: '2026-10-15T22:00:00.000Z',
        },
      ],
    },
    {
      id: 'thread-ice-house',
      authorId: 'member-maya',
      title: 'The ice-house letter',
      body: "Chapter 6's letter changes how I see Aunt Bea. Was she ever really at the vicarage?",
      checkpointIndex: 2,
      createdAt: '2026-10-11T20:00:00.000Z',
      replies: [
        {
          id: 'reply-ice-house-1',
          threadId: 'thread-ice-house',
          authorId: 'member-sam',
          body: 'Same here. Her alibi does not hold up any more.',
          checkpointIndex: 2,
          createdAt: '2026-10-11T22:30:00.000Z',
        },
      ],
    },
    {
      id: 'thread-fen-ending',
      authorId: 'member-sam',
      title: 'That ending!',
      body: "I did not expect the fen to freeze over Bea's secret like that. Was the last chapter fair?",
      checkpointIndex: 4,
      createdAt: '2026-10-16T09:00:00.000Z',
      replies: [],
    },
  ],
}

export const demoClubs: DemoClub[] = [
  {
    club: { id: 'club-thursday-readers', name: 'Thursday Night Readers' },
    ownerId: 'member-riley',
    inviteCode: 'SALTORCH01',
    memberIds: ['member-maya', 'member-jordan', 'member-riley'],
    books: [saltOrchard],
  },
  {
    club: { id: 'club-harbour-lights', name: 'Harbour Lights Book Circle' },
    ownerId: 'member-maya',
    inviteCode: 'HARBOUR001',
    memberIds: ['member-maya', 'member-riley', 'member-sam'],
    books: [glassCartographer, harrowFen],
  },
]
