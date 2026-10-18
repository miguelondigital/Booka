import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Checkpoint, ClubSnapshot, Member, NewReplyInput, NewThreadInput } from '@shared/types'
import { buildVisibleFeed } from '@shared/visibility'
import { connectRepository, type ClubRepository, type Connection } from '@/data/repository'

const ACTIVE_MEMBER_KEY = 'booka.activeMemberId'

function readActiveMemberId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_MEMBER_KEY)
  } catch {
    return null
  }
}

function saveActiveMemberId(memberId: string) {
  try {
    localStorage.setItem(ACTIVE_MEMBER_KEY, memberId)
  } catch {
    // Remembering the selected member is a convenience only.
  }
}

export const useClubStore = defineStore('club', () => {
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const loadError = ref<string | null>(null)
  const repository = shallowRef<ClubRepository | null>(null)
  // The unfiltered discussion is intentionally NOT returned from the store:
  // components can only reach threads through `visibleFeed`.
  const snapshot = ref<ClubSnapshot | null>(null)
  const activeMemberId = ref<string | null>(readActiveMemberId())

  const dataSource = computed(() => repository.value?.dataSource ?? 'demo')
  const club = computed(() => snapshot.value?.club ?? null)
  const book = computed(() => snapshot.value?.book ?? null)
  const checkpoints = computed<Checkpoint[]>(() => snapshot.value?.checkpoints ?? [])
  const members = computed<Member[]>(() => snapshot.value?.members ?? [])

  const activeMember = computed<Member | null>(
    () =>
      members.value.find((member) => member.id === activeMemberId.value) ??
      members.value[0] ??
      null,
  )
  const activeCheckpoint = computed(() =>
    activeMember.value ? checkpoints.value[activeMember.value.checkpointIndex] : undefined,
  )

  /** The discussion as the active member may see it — the only feed the UI renders. */
  const visibleFeed = computed(() =>
    snapshot.value && activeMember.value
      ? buildVisibleFeed(snapshot.value.threads, activeMember.value.checkpointIndex)
      : [],
  )

  function memberById(memberId: string): Member | undefined {
    return members.value.find((member) => member.id === memberId)
  }

  function checkpointLabel(index: number): string {
    return checkpoints.value[index]?.label ?? `Checkpoint ${index}`
  }

  function requireReady() {
    const member = activeMember.value
    if (!repository.value || !snapshot.value || !member)
      throw new Error('The club is still loading.')
    return { repository: repository.value, snapshot: snapshot.value, member }
  }

  async function init(connect: () => Promise<Connection> = connectRepository) {
    status.value = 'loading'
    loadError.value = null
    try {
      const connection = await connect()
      repository.value = connection.repository
      snapshot.value = connection.snapshot
      status.value = 'ready'
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : String(error)
      status.value = 'error'
    }
  }

  function selectMember(memberId: string) {
    if (!memberById(memberId)) return
    activeMemberId.value = memberId
    saveActiveMemberId(memberId)
  }

  let progressRequest = 0

  /** Move the active member's checkpoint. The feed updates immediately. */
  async function setCheckpoint(checkpointIndex: number) {
    const { repository: repo, member } = requireReady()
    const previous = member.checkpointIndex
    const request = ++progressRequest
    member.checkpointIndex = checkpointIndex
    try {
      const updated = await repo.updateProgress(member.id, checkpointIndex)
      if (request === progressRequest) member.checkpointIndex = updated.checkpointIndex
    } catch (error) {
      if (request === progressRequest) member.checkpointIndex = previous
      throw error
    }
  }

  async function createThread(input: NewThreadInput) {
    const { repository: repo, snapshot: current, member } = requireReady()
    const thread = await repo.createThread(member.id, input)
    current.threads.push(thread)
    return thread
  }

  async function reply(threadId: string, input: NewReplyInput) {
    const { repository: repo, snapshot: current, member } = requireReady()
    const created = await repo.createReply(member.id, threadId, input)
    current.threads.find((thread) => thread.id === threadId)?.replies.push(created)
    return created
  }

  /** Demo mode: drop browser-saved progress and posts, back to the fixtures. */
  async function resetDemo() {
    const { repository: repo } = requireReady()
    await repo.reset?.()
    snapshot.value = await repo.load()
  }

  return {
    status,
    loadError,
    dataSource,
    club,
    book,
    checkpoints,
    members,
    activeMember,
    activeCheckpoint,
    visibleFeed,
    memberById,
    checkpointLabel,
    init,
    selectMember,
    setCheckpoint,
    createThread,
    reply,
    resetDemo,
  }
})
