// Data shapes shared by the Express API and the Vue client.
// Checkpoints are referenced by their 0-based `index` within a book,
// because that is what the visibility rule compares.

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

/** A club member and their checkpoint in a particular book. */
export interface Member {
  id: string
  name: string
  checkpointIndex: number
}

/** The signed-in account. */
export interface Account {
  id: string
  name: string
  email: string
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

/** A complete thread. Server-side only: never sent to clients unfiltered. */
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

// ---- API payloads -------------------------------------------------------

/** One card on the homepage (GET /api/clubs). */
export interface ClubCard {
  id: string
  name: string
  isOwner: boolean
  memberCount: number
  currentBook: (Book & { checkpointCount: number; checkpointLabels: string[] }) | null
  /** Your checkpoint in the current book. */
  myCheckpointIndex: number | null
  /** Every member's checkpoint in the current book. */
  members: Member[]
}

export interface BookSummary extends Book {
  startedAt: string
  isCurrent: boolean
  checkpointCount: number
}

export interface ClubMember {
  id: string
  name: string
  isOwner: boolean
  joinedAt: string
}

/** GET /api/clubs/:clubId */
export interface ClubDetail {
  club: Club
  isOwner: boolean
  ownerId: string
  /** Any member may share it; only the owner can reset it. */
  inviteCode: string
  /** Newest first; the first one is the current book. */
  books: BookSummary[]
  members: ClubMember[]
  /** Removed members who cannot rejoin. Only filled in for the owner. */
  blocked: { id: string; name: string }[]
}

/** GET /api/clubs/:clubId/books/:bookId — no discussion content. */
export interface BookOverview {
  club: Club
  book: BookSummary
  checkpoints: Checkpoint[]
  /** Current club members and their checkpoint in this book. */
  members: Member[]
  me: Member
}

/** GET …/books/:bookId/discussion — already filtered by the server. */
export interface Discussion {
  readerCheckpointIndex: number
  threads: VisibleThread[]
}

/** PUT …/books/:bookId/progress */
export interface ProgressResult {
  me: Member
  discussion: Discussion
}

/** GET /api/invites/:code */
export interface InvitePreview {
  club: Club
  currentBook: Book | null
  memberCount: number
  alreadyMember: boolean
  blocked: boolean
}

/** A book the member has progress in, across all clubs. */
export interface HistoryEntry {
  clubId: string
  clubName: string
  /** False once the member left the club (progress is kept). */
  isMember: boolean
  bookId: string
  title: string
  author: string
  isCurrent: boolean
  startedAt: string
  checkpointIndex: number
  checkpointLabel: string
  checkpointCount: number
}

/** GET /api/account */
export interface AccountProfile {
  account: Account
  history: HistoryEntry[]
  /** Clubs you own; ones with other members must change owner before you can delete your account. */
  ownedClubs: { id: string; name: string; otherMemberCount: number }[]
}

export interface SignupInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface NewBookInput {
  title: string
  author: string
  /** Checkpoint labels in reading order. */
  checkpoints: string[]
}

export interface NewClubInput {
  name: string
  book: NewBookInput
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
