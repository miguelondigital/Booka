import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  BookOverview,
  ClubDetail,
  Discussion,
  Member,
  NewReplyInput,
  NewThreadInput,
} from '@shared/types'
import { api } from '@/data/api'

/** The club page: one book of one club, its members' progress and discussion. */
export const useClubStore = defineStore('club', () => {
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const loadError = ref<string | null>(null)
  const detail = ref<ClubDetail | null>(null)
  const overview = ref<BookOverview | null>(null)
  /** Server-filtered for the signed-in member. Never contains hidden content. */
  const discussion = ref<Discussion | null>(null)
  const updatingProgress = ref(false)

  const club = computed(() => overview.value?.club ?? detail.value?.club ?? null)
  const book = computed(() => overview.value?.book ?? null)
  const books = computed(() => detail.value?.books ?? [])
  const currentBook = computed(() => books.value.find((candidate) => candidate.isCurrent) ?? null)
  const isOwner = computed(() => detail.value?.isOwner ?? false)
  const checkpoints = computed(() => overview.value?.checkpoints ?? [])
  const members = computed<Member[]>(() => overview.value?.members ?? [])
  const me = computed(() => overview.value?.me ?? null)
  const myCheckpoint = computed(() =>
    me.value ? checkpoints.value[me.value.checkpointIndex] : undefined,
  )
  const feed = computed(() => discussion.value?.threads ?? [])

  function memberById(memberId: string): Member | undefined {
    return members.value.find((member) => member.id === memberId)
  }

  function checkpointLabel(index: number): string {
    return checkpoints.value[index]?.label ?? `Checkpoint ${index}`
  }

  let loadRequest = 0

  /** Load a club and one of its books (the current book when bookId is omitted). */
  async function load(clubId: string, bookId?: string) {
    const request = ++loadRequest
    status.value = 'loading'
    loadError.value = null
    try {
      const nextDetail = await api.clubDetail(clubId)
      const targetId = bookId ?? nextDetail.books[0]?.id
      if (!targetId) throw new Error('This club has no books yet.')
      const [nextOverview, nextDiscussion] = await Promise.all([
        api.book(clubId, targetId),
        api.discussion(clubId, targetId),
      ])
      if (request !== loadRequest) return
      detail.value = nextDetail
      overview.value = nextOverview
      discussion.value = nextDiscussion
      status.value = 'ready'
    } catch (error) {
      if (request !== loadRequest) return
      loadError.value = error instanceof Error ? error.message : String(error)
      status.value = 'error'
    }
  }

  function requireReady() {
    if (!overview.value || !discussion.value) throw new Error('The club is still loading.')
    return {
      clubId: overview.value.club.id,
      bookId: overview.value.book.id,
      current: overview.value,
      currentDiscussion: discussion.value,
    }
  }

  let progressRequest = 0

  /**
   * Move the signed-in member's checkpoint in this book. The server answers
   * with the newly visible discussion, which replaces the feed in one step.
   */
  async function setCheckpoint(checkpointIndex: number) {
    const { clubId, bookId, current } = requireReady()
    const request = ++progressRequest
    updatingProgress.value = true
    try {
      const result = await api.updateProgress(clubId, bookId, checkpointIndex)
      if (request !== progressRequest) return
      current.me = result.me
      const entry = current.members.find((member) => member.id === result.me.id)
      if (entry) entry.checkpointIndex = result.me.checkpointIndex
      discussion.value = result.discussion
    } finally {
      if (request === progressRequest) updatingProgress.value = false
    }
  }

  async function createThread(input: NewThreadInput) {
    const { clubId, bookId, currentDiscussion } = requireReady()
    const thread = await api.createThread(clubId, bookId, input)
    currentDiscussion.threads.unshift(thread)
    return thread
  }

  async function reply(threadId: string, input: NewReplyInput) {
    const { clubId, bookId, currentDiscussion } = requireReady()
    const created = await api.createReply(clubId, bookId, threadId, input)
    const thread = currentDiscussion.threads.find((candidate) => candidate.id === threadId)
    if (thread) {
      thread.replies.push(created)
      thread.lastActivityAt = created.createdAt
    }
    return created
  }

  function $reset() {
    loadRequest++
    status.value = 'idle'
    loadError.value = null
    detail.value = null
    overview.value = null
    discussion.value = null
  }

  return {
    status,
    loadError,
    club,
    book,
    books,
    currentBook,
    isOwner,
    checkpoints,
    members,
    me,
    myCheckpoint,
    feed,
    updatingProgress,
    memberById,
    checkpointLabel,
    load,
    setCheckpoint,
    createThread,
    reply,
    $reset,
  }
})
