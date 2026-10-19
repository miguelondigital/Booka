<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { AccountProfile } from '@shared/types'
import { LIMITS, validateEmail, validateName } from '@shared/validation'
import { api } from '@/data/api'
import { useAuthStore } from '@/stores/auth'
import { useClubStore } from '@/stores/club'

const auth = useAuthStore()
const clubStore = useClubStore()
const router = useRouter()

const profile = ref<AccountProfile | null>(null)
const loadError = ref<string | null>(null)

const name = ref('')
const nameStatus = ref<{ ok: boolean; text: string } | null>(null)
const email = ref('')
const emailPassword = ref('')
const emailStatus = ref<{ ok: boolean; text: string } | null>(null)
const deletePassword = ref('')
const deleteError = ref<string | null>(null)
const busy = ref<string | null>(null)

const mustTransfer = computed(
  () => profile.value?.ownedClubs.filter((club) => club.otherMemberCount > 0) ?? [],
)
const soloClubs = computed(
  () => profile.value?.ownedClubs.filter((club) => club.otherMemberCount === 0) ?? [],
)

const message = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

onMounted(async () => {
  try {
    profile.value = await api.profile()
    name.value = profile.value.account.name
    email.value = profile.value.account.email
  } catch (cause) {
    loadError.value = message(cause, 'Could not load your account.')
  }
})

async function saveName() {
  const error = validateName(name.value)
  if (error) {
    nameStatus.value = { ok: false, text: error }
    return
  }
  busy.value = 'name'
  try {
    const account = await api.updateName(name.value)
    auth.setAccount(account)
    nameStatus.value = { ok: true, text: 'Name updated.' }
  } catch (cause) {
    nameStatus.value = { ok: false, text: message(cause, 'Could not update your name.') }
  } finally {
    busy.value = null
  }
}

async function saveEmail() {
  const error =
    validateEmail(email.value) ?? (emailPassword.value ? null : 'Enter your current password.')
  if (error) {
    emailStatus.value = { ok: false, text: error }
    return
  }
  busy.value = 'email'
  try {
    const account = await api.changeEmail(email.value, emailPassword.value)
    auth.setAccount(account)
    email.value = account.email
    emailPassword.value = ''
    emailStatus.value = { ok: true, text: 'Email updated. Use it next time you sign in.' }
  } catch (cause) {
    emailStatus.value = { ok: false, text: message(cause, 'Could not update your email.') }
  } finally {
    busy.value = null
  }
}

async function deleteAccount() {
  if (!deletePassword.value) {
    deleteError.value = 'Enter your password to confirm.'
    return
  }
  if (!confirm('Delete your account? This cannot be undone.')) return
  busy.value = 'delete'
  deleteError.value = null
  try {
    await api.deleteAccount(deletePassword.value)
    auth.sessionEnded()
    clubStore.$reset()
    await router.replace({ name: 'login' })
  } catch (cause) {
    deleteError.value = message(cause, 'Could not delete your account.')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="page page--narrow">
    <RouterLink :to="{ name: 'home' }" class="back-link">← Your clubs</RouterLink>

    <div v-if="loadError" class="state card state--column" role="alert">
      <h2>We couldn't load your account</h2>
      <p>{{ loadError }}</p>
    </div>

    <div v-else-if="!profile" class="state" role="status">
      <span class="spinner" aria-hidden="true"></span>
      Loading…
    </div>

    <template v-else>
      <header class="page-header">
        <div>
          <h1 class="page-title">Your account</h1>
          <p class="page-lede">{{ profile.account.email }}</p>
        </div>
      </header>

      <div class="stack">
        <section class="section card" aria-labelledby="history-heading">
          <h2 id="history-heading" class="section__title">Reading history</h2>
          <p v-if="profile.history.length === 0" class="section__hint">
            Books you read in your clubs will show up here.
          </p>
          <ul v-else class="list-plain history">
            <li v-for="entry in profile.history" :key="entry.bookId" class="history__item">
              <div class="history__main">
                <RouterLink
                  v-if="entry.isMember"
                  :to="
                    entry.isCurrent
                      ? { name: 'club', params: { clubId: entry.clubId } }
                      : {
                          name: 'club-book',
                          params: { clubId: entry.clubId, bookId: entry.bookId },
                        }
                  "
                  class="history__title"
                >
                  {{ entry.title }}
                </RouterLink>
                <span v-else class="history__title">{{ entry.title }}</span>
                <span class="muted">
                  {{ entry.author }} · {{ entry.clubName }}{{ entry.isMember ? '' : ' (you left)' }}
                </span>
              </div>
              <div class="history__progress">
                <span :class="['badge', entry.isCurrent && 'badge--accent']">
                  {{ entry.isCurrent ? 'Reading now' : 'Past' }}
                </span>
                <span class="history__checkpoint">
                  {{ entry.checkpointLabel }}
                  <span class="muted"
                    >· {{ entry.checkpointIndex + 1 }}/{{ entry.checkpointCount }}</span
                  >
                </span>
                <span
                  class="history__bar"
                  role="presentation"
                  :style="{
                    '--fill': `${((entry.checkpointIndex + 1) / entry.checkpointCount) * 100}%`,
                  }"
                ></span>
              </div>
            </li>
          </ul>
        </section>

        <form class="section card" novalidate @submit.prevent="saveName">
          <h2 class="section__title">Name</h2>
          <div class="form-row">
            <div class="field">
              <label for="account-name">Shown to your club-mates</label>
              <input
                id="account-name"
                v-model="name"
                class="input"
                :maxlength="LIMITS.nameMax"
                autocomplete="name"
              />
            </div>
            <button type="submit" class="btn btn-ghost" :disabled="busy !== null">Save</button>
          </div>
          <p v-if="nameStatus" :class="nameStatus.ok ? 'form-success' : 'form-error'" role="status">
            {{ nameStatus.text }}
          </p>
        </form>

        <form class="section card" novalidate @submit.prevent="saveEmail">
          <h2 class="section__title">Email</h2>
          <p class="section__hint">
            You sign in with this email. Confirm with your current password.
          </p>
          <div class="form-row">
            <div class="field">
              <label for="account-email">Email</label>
              <input
                id="account-email"
                v-model="email"
                class="input"
                type="email"
                autocomplete="email"
                :maxlength="LIMITS.emailMax"
              />
            </div>
            <div class="field">
              <label for="account-email-password">Current password</label>
              <input
                id="account-email-password"
                v-model="emailPassword"
                class="input"
                type="password"
                autocomplete="current-password"
              />
            </div>
            <button type="submit" class="btn btn-ghost" :disabled="busy !== null">
              Update email
            </button>
          </div>
          <p
            v-if="emailStatus"
            :class="emailStatus.ok ? 'form-success' : 'form-error'"
            role="status"
          >
            {{ emailStatus.text }}
          </p>
        </form>

        <form class="section card danger-zone" novalidate @submit.prevent="deleteAccount">
          <h2 class="section__title">Delete account</h2>
          <template v-if="mustTransfer.length">
            <p class="section__hint">Before you can delete your account, choose a new owner for:</p>
            <ul class="transfer-list">
              <li v-for="club in mustTransfer" :key="club.id">
                <RouterLink
                  :to="{ name: 'club-settings', params: { clubId: club.id } }"
                  class="link"
                >
                  {{ club.name }}
                </RouterLink>
              </li>
            </ul>
          </template>
          <template v-else>
            <p class="section__hint">
              You'll leave all your clubs and won't be able to sign in. Your posts stay, shown as
              "Former member".
              <template v-if="soloClubs.length">
                Clubs where you're the only member will be deleted:
                {{ soloClubs.map((club) => club.name).join(', ') }}.
              </template>
            </p>
            <div class="form-row">
              <div class="field">
                <label for="delete-password">Password</label>
                <input
                  id="delete-password"
                  v-model="deletePassword"
                  class="input"
                  type="password"
                  autocomplete="current-password"
                />
              </div>
              <button type="submit" class="btn btn-danger" :disabled="busy !== null">
                Delete my account
              </button>
            </div>
          </template>
          <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
        </form>
      </div>
    </template>
  </div>
</template>

<style scoped>
.history {
  display: grid;
}

.history__item {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

.history__item:last-child {
  border-bottom: 0;
}

.history__main {
  display: grid;
  min-width: 0;
}

.history__title {
  font-family: var(--font-serif);
  font-weight: 600;
  font-size: 1.05rem;
  color: var(--ink);
}

.history__progress {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  justify-items: end;
  gap: 0.3rem 0.6rem;
  min-width: 12rem;
}

.history__checkpoint {
  font-size: 0.875rem;
}

.history__bar {
  grid-column: 1 / -1;
  justify-self: stretch;
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent) var(--fill), var(--surface-2) var(--fill));
  border: 1px solid var(--line);
}

.transfer-list {
  margin: 0;
  padding-left: 1.2rem;
}

.danger-zone {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--line));
}
</style>
