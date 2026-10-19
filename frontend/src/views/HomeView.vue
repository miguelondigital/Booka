<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { ClubCard } from '@shared/types'
import { normalizeInviteCode } from '@shared/validation'
import { api } from '@/data/api'
import { useAuthStore } from '@/stores/auth'
import ClubTile from '@/components/ClubTile.vue'

const auth = useAuthStore()
const router = useRouter()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const error = ref<string | null>(null)
const clubs = ref<ClubCard[]>([])
const inviteCode = ref('')
const inviteError = ref<string | null>(null)

async function load() {
  state.value = 'loading'
  try {
    clubs.value = await api.clubs()
    state.value = 'ready'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
    state.value = 'error'
  }
}

/** Accept a bare code or a pasted invite link. */
function joinWithCode() {
  const raw = inviteCode.value.trim()
  const fromLink = raw.match(/\/join\/([^/?#\s]+)/)?.[1]
  const code = normalizeInviteCode(fromLink ?? raw)
  if (!code) {
    inviteError.value = 'Enter an invite code or paste an invite link.'
    return
  }
  inviteError.value = null
  void router.push({ name: 'join', params: { code } })
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Your book clubs</h1>
        <p v-if="clubs.length" class="page-lede">
          Hi {{ auth.account?.name }}. Here's where everyone is.
        </p>
      </div>
      <RouterLink :to="{ name: 'new-club' }" class="btn btn-primary">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create a club
      </RouterLink>
    </header>

    <div class="home">
      <section class="home__clubs" aria-label="Your clubs">
        <div v-if="state === 'loading'" class="state" role="status">
          <span class="spinner" aria-hidden="true"></span>
          Loading your clubs…
        </div>

        <div v-else-if="state === 'error'" class="state card state--column" role="alert">
          <h2>We couldn't load your clubs</h2>
          <p>{{ error }}</p>
          <button type="button" class="btn btn-primary" @click="load">Try again</button>
        </div>

        <div v-else-if="clubs.length === 0" class="empty card">
          <h2 class="empty__title">You're not in any book clubs yet</h2>
          <p class="page-lede">
            Start one for your friends, or join one with an invite link from a club member.
          </p>
          <RouterLink :to="{ name: 'new-club' }" class="btn btn-primary">Create a club</RouterLink>
        </div>

        <div v-else class="home__grid">
          <ClubTile v-for="club in clubs" :key="club.id" :club="club" :me-id="auth.account!.id" />
        </div>
      </section>

      <aside class="home__aside">
        <form class="section card" novalidate @submit.prevent="joinWithCode">
          <h2 class="section__title">Join a club</h2>
          <p class="section__hint">
            Paste an invite link or type the code a member shared with you.
          </p>
          <div class="field">
            <label for="invite-code">Invite code or link</label>
            <input
              id="invite-code"
              v-model="inviteCode"
              class="input"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              placeholder="e.g. HARBOUR001"
            />
          </div>
          <p v-if="inviteError" class="form-error" role="alert">{{ inviteError }}</p>
          <button type="submit" class="btn btn-ghost">Continue</button>
        </form>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 1.5rem;
  align-items: start;
}

.home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 1rem;
}

.home__clubs > .state {
  margin: 2rem auto;
}

.empty {
  display: grid;
  justify-items: start;
  gap: 0.6rem;
  padding: 1.75rem 1.5rem;
}

.empty__title {
  font-size: 1.3rem;
}

@media (max-width: 880px) {
  .home {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
