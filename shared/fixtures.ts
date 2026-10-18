import type { ClubSnapshot } from './types.js'

/**
 * Predictable demo data. Used by:
 *  - GET /api/demo when DATA_SOURCE=demo
 *  - the idempotent Prisma seed (prisma/seed.ts), so DB mode starts identical
 *  - the acceptance tests
 *
 * "The Salt Orchard" and its author are fictional, so the discussion can
 * contain real "spoilers" without spoiling a real book.
 *
 * Invariant: every thread/reply is stamped at or below its author's current
 * checkpoint, and every reply is at or above its thread's checkpoint.
 */
export const demoFixtures: ClubSnapshot = {
  club: { id: 'club-thursday-readers', name: 'Thursday Night Readers' },
  book: { id: 'book-salt-orchard', title: 'The Salt Orchard', author: 'Imogen Hale' },
  checkpoints: [
    { id: 'checkpoint-0', index: 0, label: 'Chapters 1-2' },
    { id: 'checkpoint-1', index: 1, label: 'Chapters 3-4' },
    { id: 'checkpoint-2', index: 2, label: 'Chapters 5-6' },
    { id: 'checkpoint-3', index: 3, label: 'Chapters 7-8' },
    { id: 'checkpoint-4', index: 4, label: 'Chapters 9-10' },
    { id: 'checkpoint-5', index: 5, label: 'Ending' },
  ],
  members: [
    { id: 'member-maya', name: 'Maya', checkpointIndex: 1 },
    { id: 'member-jordan', name: 'Jordan', checkpointIndex: 3 },
    { id: 'member-riley', name: 'Riley', checkpointIndex: 5 },
  ],
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
