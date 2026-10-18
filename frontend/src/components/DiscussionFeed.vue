<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Member, NewThreadInput } from '@shared/types'
import type { VisibleThread } from '@shared/visibility'
import { plural } from '@/format'
import NewThreadForm from './NewThreadForm.vue'
import ThreadCard from './ThreadCard.vue'

const props = defineProps<{
  feed: VisibleThread[]
  reader: Member
  readerCheckpointLabel: string
  memberById: (memberId: string) => Member | undefined
  checkpointLabel: (index: number) => string
  createThread: (input: NewThreadInput) => Promise<unknown>
  reply: (threadId: string, body: string) => Promise<unknown>
}>()

const composing = ref(false)

// A draft belongs to the member who started it.
watch(
  () => props.reader.id,
  () => (composing.value = false),
)
</script>

<template>
  <section class="feed" aria-labelledby="feed-heading">
    <div class="feed__header">
      <div>
        <h2 id="feed-heading" class="feed__title">Discussion</h2>
        <p class="feed__subtitle" aria-live="polite">
          {{ plural(feed.length, 'thread') }} visible to {{ reader.name }}, through
          <strong>{{ readerCheckpointLabel }}</strong>
        </p>
      </div>
      <button v-if="!composing" type="button" class="btn btn-primary" @click="composing = true">
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
        New thread
      </button>
    </div>

    <NewThreadForm
      v-if="composing"
      :key="reader.id"
      :author-name="reader.name"
      :checkpoint-label="readerCheckpointLabel"
      :submit="createThread"
      @done="composing = false"
    />

    <!-- No list transition: threads that become hidden must leave the DOM immediately. -->
    <!-- Keyed by reader so open reply drafts never carry over to another member. -->
    <div v-if="feed.length" :key="reader.id" class="feed__list">
      <ThreadCard
        v-for="thread in feed"
        :key="thread.id"
        :thread="thread"
        :reader-name="reader.name"
        :reader-checkpoint-label="readerCheckpointLabel"
        :member-by-id="memberById"
        :checkpoint-label="checkpointLabel"
        :reply="reply"
      />
    </div>

    <div v-else class="empty card">
      <p class="empty__title">Nothing to discuss yet at {{ readerCheckpointLabel }}.</p>
      <p class="empty__text">
        Start the first thread, or keep reading to unlock more of the conversation.
      </p>
    </div>
  </section>
</template>

<style scoped>
.feed {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.feed__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.feed__title {
  font-size: 1.6rem;
}

.feed__subtitle {
  color: var(--ink-2);
  font-size: 0.9375rem;
}

.feed__list {
  display: grid;
  gap: 1rem;
}

.empty {
  padding: 2rem 1.25rem;
  text-align: center;
}

.empty__title {
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 600;
}

.empty__text {
  color: var(--ink-2);
  margin-top: 0.25rem;
}
</style>
