// Data shapes shared by the Express API and the Vue client.
// Checkpoints are referenced by their 0-based `index` within the book,
// because that is what the visibility rule compares.

export type DataSource = 'demo' | 'db'

export interface Club {
  id: string
  name: string
}

export interface Book {
  id: string
  title: string
  author: string
}

export interface Checkpoint {
  id: string
  index: number
  label: string
}

export interface Member {
  id: string
  name: string
  /** The member's current reading checkpoint. */
  checkpointIndex: number
}

/** A reply inside a thread (stored as a `Post` row in the database). */
export interface Reply {
  id: string
  threadId: string
  authorId: string
  body: string
  /** Stamped from the author's progress when the reply was created. */
  checkpointIndex: number
  createdAt: string
}

export interface Thread {
  id: string
  authorId: string
  title: string
  body: string
  /** Stamped from the author's progress when the thread was created. */
  checkpointIndex: number
  createdAt: string
  replies: Reply[]
}

export interface ClubSnapshot {
  club: Club
  book: Book
  checkpoints: Checkpoint[]
  members: Member[]
  threads: Thread[]
}

/** Response of GET /api/demo. */
export interface DemoPayload extends ClubSnapshot {
  dataSource: DataSource
}

/** Client input for a new thread. There is deliberately no checkpoint field. */
export interface NewThreadInput {
  title: string
  body: string
}

/** Client input for a new reply. There is deliberately no checkpoint field. */
export interface NewReplyInput {
  body: string
}
