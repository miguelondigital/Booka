<script setup lang="ts">
import type { Member } from '@shared/types'
import { HIDDEN_REPLIES_MESSAGE, type VisibleThread } from '@shared/visibility'
import { formatDay, formatFull, plural } from '@/format'
import MemberAvatar from './MemberAvatar.vue'
import ReplyForm from './ReplyForm.vue'

/** Renders an already-filtered thread. It never decides visibility itself. */
defineProps<{
  thread: VisibleThread
  readerName: string
  readerCheckpointLabel: string
  memberById: (memberId: string) => Member | undefined
  checkpointLabel: (index: number) => string
  reply: (threadId: string, body: string) => Promise<unknown>
}>()
</script>

<template>
  <article class="thread card" :aria-labelledby="`thread-title-${thread.id}`">
    <header class="thread__header">
      <span class="chip">{{ checkpointLabel(thread.checkpointIndex) }}</span>
      <time class="thread__date" :datetime="thread.createdAt" :title="formatFull(thread.createdAt)">
        {{ formatDay(thread.createdAt) }}
      </time>
    </header>

    <h3 :id="`thread-title-${thread.id}`" class="thread__title">{{ thread.title }}</h3>

    <div class="byline">
      <MemberAvatar
        :member-id="thread.authorId"
        :name="memberById(thread.authorId)?.name ?? '?'"
        size="sm"
      />
      <span>{{ memberById(thread.authorId)?.name ?? 'Former member' }}</span>
    </div>

    <p class="thread__body">{{ thread.body }}</p>

    <section class="replies" :aria-label="`Replies to ${thread.title}`">
      <p v-if="thread.replies.length || thread.hiddenReplyCount" class="replies__count">
        {{ plural(thread.replies.length, 'reply', 'replies') }}
      </p>

      <ol v-if="thread.replies.length" class="replies__list">
        <li v-for="reply in thread.replies" :key="reply.id" class="reply">
          <MemberAvatar
            :member-id="reply.authorId"
            :name="memberById(reply.authorId)?.name ?? '?'"
            size="sm"
          />
          <div class="reply__content">
            <div class="reply__meta">
              <span class="reply__author">{{
                memberById(reply.authorId)?.name ?? 'Former member'
              }}</span>
              <span class="reply__checkpoint">{{ checkpointLabel(reply.checkpointIndex) }}</span>
              <time :datetime="reply.createdAt" :title="formatFull(reply.createdAt)">{{
                formatDay(reply.createdAt)
              }}</time>
            </div>
            <p class="reply__body">{{ reply.body }}</p>
          </div>
        </li>
      </ol>

      <div v-if="thread.hiddenReplyCount > 0" class="veil" role="note">
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
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span class="veil__text">{{ HIDDEN_REPLIES_MESSAGE }}</span>
        <span
          class="veil__count"
          :aria-label="plural(thread.hiddenReplyCount, 'hidden reply', 'hidden replies')"
        >
          {{ thread.hiddenReplyCount }}
        </span>
      </div>

      <ReplyForm
        :thread-id="thread.id"
        :author-name="readerName"
        :checkpoint-label="readerCheckpointLabel"
        :submit="(body: string) => reply(thread.id, body)"
      />
    </section>
  </article>
</template>

<style scoped>
.thread {
  display: grid;
  gap: 0.6rem;
  padding: 1.1rem 1.15rem;
}

.thread__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.thread__date {
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.thread__title {
  font-size: 1.25rem;
}

.byline {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink-2);
}

.thread__body {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.replies {
  display: grid;
  gap: 0.7rem;
  margin-top: 0.4rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--line);
}

.replies__count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-3);
}

.replies__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.8rem;
}

.reply {
  display: flex;
  gap: 0.6rem;
}

.reply > :first-child {
  margin-top: 0.15rem;
}

.reply__content {
  min-width: 0;
  flex: 1;
  padding: 0.55rem 0.75rem;
  border-radius: 4px var(--radius-sm) var(--radius-sm) var(--radius-sm);
  background: var(--surface-2);
}

.reply__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.5rem;
  font-size: 0.75rem;
  color: var(--ink-3);
}

.reply__author {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
}

.reply__checkpoint {
  font-weight: 600;
  color: var(--accent);
}

.reply__body {
  font-size: 0.9375rem;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.veil {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--veil-line);
  background: var(--veil-soft);
  color: var(--veil);
  font-size: 0.875rem;
}

.veil__text {
  flex: 1;
}

.veil__count {
  min-width: 1.6rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--veil);
  color: var(--surface);
  font-weight: 700;
  font-size: 0.8125rem;
  text-align: center;
}
</style>
