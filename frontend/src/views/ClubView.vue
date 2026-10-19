<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { NewThreadInput } from '@shared/types'
import { useClubStore } from '@/stores/club'
import BookProgress from '@/components/BookProgress.vue'
import DiscussionFeed from '@/components/DiscussionFeed.vue'

/** A club's book page. Without bookId it shows the club's current book. */
const props = defineProps<{ clubId: string; bookId?: string }>()

const router = useRouter()
const store = useClubStore()
const {
  status,
  loadError,
  club,
  book,
  books,
  currentBook,
  checkpoints,
  members,
  me,
  myCheckpoint,
  feed,
  updatingProgress,
} = storeToRefs(store)

const progressError = ref<string | null>(null)

watch(
  () => [props.clubId, props.bookId] as const,
  ([clubId, bookId]) => {
    progressError.value = null
    void store.load(clubId, bookId)
  },
  { immediate: true },
)

watch(club, (current) => {
  if (current) document.title = `${current.name} · Booka`
})

const selectedBookId = computed({
  get: () => book.value?.id ?? '',
  set: (bookId: string) => {
    const target = books.value.find((candidate) => candidate.id === bookId)
    void router.push(
      target?.isCurrent
        ? { name: 'club', params: { clubId: props.clubId } }
        : { name: 'club-book', params: { clubId: props.clubId, bookId } },
    )
  },
})

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
</script>

<template>
  <div v-if="status === 'loading' || status === 'idle'" class="state" role="status">
    <span class="spinner" aria-hidden="true"></span>
    Opening the book club…
  </div>

  <div v-else-if="status === 'error'" class="state card state--column" role="alert">
    <h2>We couldn't load this book club</h2>
    <p>{{ loadError }}</p>
    <div class="state__actions">
      <button type="button" class="btn btn-primary" @click="store.load(clubId, bookId)">
        Try again
      </button>
      <RouterLink :to="{ name: 'home' }" class="btn btn-ghost">Your clubs</RouterLink>
    </div>
  </div>

  <div v-else-if="club && book && me" class="page">
    <header class="club-header">
      <div class="club-header__title">
        <RouterLink :to="{ name: 'home' }" class="back-link">← Your clubs</RouterLink>
        <h1 class="page-title">{{ club.name }}</h1>
      </div>
      <div class="club-header__actions">
        <label v-if="books.length > 1" class="book-switcher">
          <span class="sr-only">Book</span>
          <select v-model="selectedBookId" class="input">
            <option v-for="candidate in books" :key="candidate.id" :value="candidate.id">
              {{ candidate.title }}{{ candidate.isCurrent ? ' (current)' : '' }}
            </option>
          </select>
        </label>
        <RouterLink :to="{ name: 'club-settings', params: { clubId } }" class="btn btn-ghost">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
            />
          </svg>
          Club settings
        </RouterLink>
      </div>
    </header>

    <p v-if="!book.isCurrent" class="past-banner" role="note">
      <strong>Past book.</strong>
      {{ club.name }} has moved on<template v-if="currentBook">
        to
        <RouterLink :to="{ name: 'club', params: { clubId } }" class="link">{{
          currentBook.title
        }}</RouterLink></template
      >. This discussion stays open, and you can still update your progress.
    </p>

    <div class="layout">
      <aside class="sidebar">
        <BookProgress
          :club="club"
          :book="book"
          :checkpoints="checkpoints"
          :members="members"
          :me="me"
          :busy="updatingProgress"
          :error="progressError"
          @change="changeCheckpoint"
        />
      </aside>

      <DiscussionFeed
        :class="{ 'feed--updating': updatingProgress }"
        :aria-busy="updatingProgress"
        :feed="feed"
        :reader="me"
        :reader-checkpoint-label="myCheckpoint?.label ?? ''"
        :member-by-id="store.memberById"
        :checkpoint-label="store.checkpointLabel"
        :create-thread="createThread"
        :reply="reply"
      />
    </div>
  </div>
</template>

<style scoped>
.club-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 1.25rem;
}

.club-header__title {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}

.club-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.book-switcher .input {
  min-height: 40px;
  padding-block: 0.45rem;
  max-width: 18rem;
}

.past-banner {
  margin-bottom: 1.25rem;
  padding: 0.7rem 0.9rem;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--veil-line);
  background: var(--veil-soft);
  color: var(--ink-2);
  font-size: 0.9375rem;
}

.state__actions {
  display: flex;
  gap: 0.5rem;
}

.layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  grid-template-areas: 'sidebar feed';
  align-items: start;
  gap: 1.5rem 2rem;
}

.sidebar {
  grid-area: sidebar;
  display: grid;
  gap: 1rem;
  position: sticky;
  top: 4.5rem;
}

.layout > .feed {
  grid-area: feed;
  transition: opacity 0.15s ease;
}

.layout > .feed--updating {
  opacity: 0.55;
}

@media (max-width: 880px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'sidebar'
      'feed';
  }

  .sidebar {
    position: static;
  }
}
</style>
