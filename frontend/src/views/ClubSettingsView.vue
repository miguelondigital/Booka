<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { ClubDetail, ClubMember } from '@shared/types'
import { LIMITS, validateClubName } from '@shared/validation'
import { api } from '@/data/api'
import { formatDay } from '@/format'
import { useAuthStore } from '@/stores/auth'
import InviteBox from '@/components/InviteBox.vue'
import MemberAvatar from '@/components/MemberAvatar.vue'

const props = defineProps<{ clubId: string }>()
const router = useRouter()
const auth = useAuthStore()

const detail = ref<ClubDetail | null>(null)
const loadError = ref<string | null>(null)
const busy = ref<string | null>(null)
const memberError = ref<string | null>(null)

const name = ref('')
const nameError = ref<string | null>(null)
const nameSaved = ref(false)
const leaveError = ref<string | null>(null)
const deleteConfirm = ref('')
const deleteError = ref<string | null>(null)

const isOwner = computed(() => detail.value?.isOwner ?? false)
const otherMembers = computed(
  () => detail.value?.members.filter((member) => member.id !== auth.account?.id) ?? [],
)

async function load() {
  try {
    detail.value = await api.clubDetail(props.clubId)
    name.value = detail.value.club.name
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : String(cause)
  }
}

onMounted(load)

const message = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

async function resetInvite() {
  const inviteCode = await api.resetInvite(props.clubId)
  if (detail.value) detail.value.inviteCode = inviteCode
}

async function makeOwner(member: ClubMember) {
  if (
    !confirm(
      `Make ${member.name} the owner of ${detail.value?.club.name}? You'll become a regular member.`,
    )
  )
    return
  busy.value = member.id
  memberError.value = null
  try {
    await api.transferOwnership(props.clubId, member.id)
    await load()
  } catch (cause) {
    memberError.value = message(cause, 'Could not change the owner.')
  } finally {
    busy.value = null
  }
}

async function removeMember(member: ClubMember) {
  if (
    !confirm(
      `Remove ${member.name} from the club? They won't be able to rejoin with the invite link unless you unblock them.`,
    )
  )
    return
  busy.value = member.id
  memberError.value = null
  try {
    await api.removeMember(props.clubId, member.id)
    await load()
  } catch (cause) {
    memberError.value = message(cause, 'Could not remove that member.')
  } finally {
    busy.value = null
  }
}

async function unblock(memberId: string) {
  busy.value = memberId
  memberError.value = null
  try {
    await api.unblock(props.clubId, memberId)
    await load()
  } catch (cause) {
    memberError.value = message(cause, 'Could not unblock.')
  } finally {
    busy.value = null
  }
}

async function rename() {
  nameSaved.value = false
  nameError.value = validateClubName(name.value)
  if (nameError.value) return
  busy.value = 'rename'
  try {
    await api.renameClub(props.clubId, name.value)
    if (detail.value) detail.value.club.name = name.value.trim()
    nameSaved.value = true
  } catch (cause) {
    nameError.value = message(cause, 'Could not rename the club.')
  } finally {
    busy.value = null
  }
}

async function leave() {
  const soleMember = isOwner.value && otherMembers.value.length === 0
  const prompt = soleMember
    ? 'You are the only member, so leaving deletes the club and all its discussion. Continue?'
    : `Leave ${detail.value?.club.name}? Your posts stay, and you can rejoin with an invite link.`
  if (!confirm(prompt)) return
  busy.value = 'leave'
  leaveError.value = null
  try {
    await api.leaveClub(props.clubId)
    await router.replace({ name: 'home' })
  } catch (cause) {
    leaveError.value = message(cause, 'Could not leave the club.')
  } finally {
    busy.value = null
  }
}

async function deleteClub() {
  if (deleteConfirm.value.trim() !== detail.value?.club.name) {
    deleteError.value = 'Type the club name exactly to confirm.'
    return
  }
  busy.value = 'delete'
  deleteError.value = null
  try {
    await api.deleteClub(props.clubId)
    await router.replace({ name: 'home' })
  } catch (cause) {
    deleteError.value = message(cause, 'Could not delete the club.')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="page page--narrow">
    <RouterLink :to="{ name: 'club', params: { clubId } }" class="back-link"
      >← Back to club</RouterLink
    >

    <div v-if="loadError" class="state card state--column" role="alert">
      <h2>We couldn't load this club</h2>
      <p>{{ loadError }}</p>
      <RouterLink :to="{ name: 'home' }" class="btn btn-ghost">Your clubs</RouterLink>
    </div>

    <div v-else-if="!detail" class="state" role="status">
      <span class="spinner" aria-hidden="true"></span>
      Loading…
    </div>

    <template v-else>
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ detail.club.name }}</h1>
          <p class="page-lede">Club settings{{ isOwner ? ' · You own this club' : '' }}</p>
        </div>
      </header>

      <div class="stack">
        <section class="section card" aria-labelledby="invite-heading">
          <h2 id="invite-heading" class="section__title">Invite people</h2>
          <p class="section__hint">
            Anyone with the link or code can join and starts at the first checkpoint.
          </p>
          <InviteBox :code="detail.inviteCode" :can-reset="isOwner" :reset="resetInvite" />
        </section>

        <section class="section card" aria-labelledby="members-heading">
          <h2 id="members-heading" class="section__title">Members ({{ detail.members.length }})</h2>
          <p v-if="memberError" class="form-error" role="alert">{{ memberError }}</p>
          <ul class="list-plain members">
            <li v-for="member in detail.members" :key="member.id" class="member">
              <MemberAvatar :member-id="member.id" :name="member.name" />
              <div class="member__text">
                <span class="member__name">
                  {{ member.name }}
                  <span v-if="member.id === auth.account?.id" class="muted">(you)</span>
                </span>
                <span class="muted">Joined {{ formatDay(member.joinedAt) }}</span>
              </div>
              <span v-if="member.isOwner" class="badge badge--accent">Owner</span>
              <div v-else-if="isOwner" class="member__actions">
                <button
                  type="button"
                  class="btn btn-quiet btn-sm"
                  :disabled="busy !== null"
                  @click="makeOwner(member)"
                >
                  Make owner
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm btn-danger-text"
                  :disabled="busy !== null"
                  @click="removeMember(member)"
                >
                  Remove
                </button>
              </div>
            </li>
          </ul>

          <template v-if="isOwner && detail.blocked.length">
            <h3 class="subheading">Removed members</h3>
            <p class="section__hint">
              They can't rejoin with the invite link until you unblock them.
            </p>
            <ul class="list-plain members">
              <li v-for="person in detail.blocked" :key="person.id" class="member">
                <MemberAvatar :member-id="person.id" :name="person.name" />
                <span class="member__name member__text">{{ person.name }}</span>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  :disabled="busy !== null"
                  @click="unblock(person.id)"
                >
                  Unblock
                </button>
              </li>
            </ul>
          </template>
        </section>

        <section class="section card" aria-labelledby="books-heading">
          <div class="section__head">
            <h2 id="books-heading" class="section__title">Books</h2>
            <RouterLink
              v-if="isOwner"
              :to="{ name: 'new-book', params: { clubId } }"
              class="btn btn-primary btn-sm"
            >
              Start the next book
            </RouterLink>
          </div>
          <ul class="list-plain books">
            <li v-for="book in detail.books" :key="book.id" class="book-row">
              <RouterLink
                :to="
                  book.isCurrent
                    ? { name: 'club', params: { clubId } }
                    : { name: 'club-book', params: { clubId, bookId: book.id } }
                "
                class="book-row__title"
              >
                {{ book.title }}
              </RouterLink>
              <span class="muted">{{ book.author }} · started {{ formatDay(book.startedAt) }}</span>
              <span :class="['badge', book.isCurrent && 'badge--accent']">
                {{ book.isCurrent ? 'Current' : 'Past' }}
              </span>
            </li>
          </ul>
        </section>

        <form v-if="isOwner" class="section card" novalidate @submit.prevent="rename">
          <h2 class="section__title">Club name</h2>
          <div class="form-row">
            <div class="field">
              <label for="club-name">Name</label>
              <input id="club-name" v-model="name" class="input" :maxlength="LIMITS.clubNameMax" />
            </div>
            <button type="submit" class="btn btn-ghost" :disabled="busy !== null">Save</button>
          </div>
          <p v-if="nameError" class="form-error" role="alert">{{ nameError }}</p>
          <p v-else-if="nameSaved" class="form-success" role="status">Saved.</p>
        </form>

        <section class="section card" aria-labelledby="leave-heading">
          <h2 id="leave-heading" class="section__title">Leave club</h2>
          <p v-if="isOwner && otherMembers.length" class="section__hint">
            You own this club. Make another member the owner before leaving.
          </p>
          <p v-else-if="isOwner" class="section__hint">
            You're the only member, so leaving deletes the club.
          </p>
          <p v-else class="section__hint">
            Your posts stay. Your progress is kept if you rejoin later.
          </p>
          <p v-if="leaveError" class="form-error" role="alert">{{ leaveError }}</p>
          <div>
            <button
              type="button"
              class="btn btn-ghost btn-danger-text"
              :disabled="busy !== null || (isOwner && otherMembers.length > 0)"
              @click="leave"
            >
              Leave {{ detail.club.name }}
            </button>
          </div>
        </section>

        <form
          v-if="isOwner"
          class="section card danger-zone"
          novalidate
          @submit.prevent="deleteClub"
        >
          <h2 class="section__title">Delete club</h2>
          <p class="section__hint">
            Permanently deletes the club, every book and all discussion, for everyone. This can't be
            undone.
          </p>
          <div class="field">
            <label for="delete-confirm"
              >Type <strong>{{ detail.club.name }}</strong> to confirm</label
            >
            <input id="delete-confirm" v-model="deleteConfirm" class="input" autocomplete="off" />
          </div>
          <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
          <div>
            <button type="submit" class="btn btn-danger" :disabled="busy !== null">
              Delete club
            </button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

<style scoped>
.section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.subheading {
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  margin-top: 0.5rem;
}

.members {
  display: grid;
  gap: 0.25rem;
}

.member {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--line);
}

.member:last-child {
  border-bottom: 0;
}

.member__text {
  display: grid;
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}

.member__name {
  font-weight: 600;
}

.member__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  justify-content: flex-end;
}

.books {
  display: grid;
  gap: 0.5rem;
}

.book-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.6rem;
}

.book-row__title {
  font-family: var(--font-serif);
  font-weight: 600;
  color: var(--ink);
}

.book-row .badge {
  margin-left: auto;
}

.danger-zone {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--line));
}
</style>
