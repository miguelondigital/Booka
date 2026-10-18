<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { NewThreadInput } from '@shared/types'
import { useClubStore } from '@/stores/club'
import BookProgress from '@/components/BookProgress.vue'
import DiscussionFeed from '@/components/DiscussionFeed.vue'
import MemberSwitcher from '@/components/MemberSwitcher.vue'

const store = useClubStore()
const {
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
} = storeToRefs(store)

const progressError = ref<string | null>(null)
const resetting = ref(false)

if (status.value === 'idle') void store.init()

function selectMember(memberId: string) {
  progressError.value = null
  store.selectMember(memberId)
}

async function changeCheckpoint(index: number) {
  progressError.value = null
  try {
    await store.setCheckpoint(index)
  } catch (error) {
    progressError.value = error instanceof Error ? error.message : 'Could not update progress.'
  }
}

const createThread = (input: NewThreadInput) => store.createThread(input)
const reply = (threadId: string, body: string) => store.reply(threadId, { body })

async function resetDemo() {
  if (!confirm('Reset the demo? Progress changes and posts saved in this browser will be removed.'))
    return
  resetting.value = true
  try {
    await store.resetDemo()
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div v-if="status === 'loading' || status === 'idle'" class="state" role="status">
    <span class="spinner" aria-hidden="true"></span>
    Opening the book club…
  </div>

  <div v-else-if="status === 'error'" class="state card state--error" role="alert">
    <h2>We couldn't load the book club</h2>
    <p>{{ loadError }}</p>
    <button type="button" class="btn btn-primary" @click="store.init()">Try again</button>
  </div>

  <div v-else-if="club && book && activeMember" class="layout">
    <aside class="sidebar">
      <MemberSwitcher
        :members="members"
        :active-member-id="activeMember.id"
        :checkpoint-label="store.checkpointLabel"
        @select="selectMember"
      />
      <BookProgress
        :club="club"
        :book="book"
        :checkpoints="checkpoints"
        :members="members"
        :active-member="activeMember"
        :error="progressError"
        @change="changeCheckpoint"
      />
    </aside>

    <DiscussionFeed
      :feed="visibleFeed"
      :reader="activeMember"
      :reader-checkpoint-label="activeCheckpoint?.label ?? ''"
      :member-by-id="store.memberById"
      :checkpoint-label="store.checkpointLabel"
      :create-thread="createThread"
      :reply="reply"
    />

    <footer class="notice">
      <p v-if="dataSource === 'demo'">
        <strong>Demo mode.</strong> Progress and new posts are saved in this browser.
        <button type="button" class="link" :disabled="resetting" @click="resetDemo">
          Reset demo data
        </button>
      </p>
      <p v-else><strong>Database mode.</strong> Progress and new posts are saved to PostgreSQL.</p>
      <p>
        Prototype note: spoiler filtering runs in the browser on self-reported progress. It shows
        the product behaviour and is not a security boundary.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  grid-template-areas:
    'sidebar feed'
    'sidebar notice';
  align-items: start;
  gap: 1.5rem 2rem;
  max-width: 1160px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.sidebar {
  grid-area: sidebar;
  display: grid;
  gap: 1rem;
  position: sticky;
  top: 4.5rem;
}

.layout > :deep(.feed) {
  grid-area: feed;
}

.notice {
  grid-area: notice;
  display: grid;
  gap: 0.35rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--accent);
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  max-width: 480px;
  margin: 4rem auto;
  padding: 1.5rem;
  color: var(--ink-2);
}

.state--error {
  flex-direction: column;
  text-align: center;
  color: var(--ink);
}

.state--error p {
  color: var(--ink-2);
}

.spinner {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 880px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'sidebar'
      'feed'
      'notice';
    padding-top: 1rem;
  }

  .sidebar {
    position: static;
  }
}
</style>
