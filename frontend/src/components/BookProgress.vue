<script setup lang="ts">
import { computed } from 'vue'
import type { BookSummary, Checkpoint, Club, Member } from '@shared/types'
import MemberAvatar from './MemberAvatar.vue'

const props = defineProps<{
  club: Club
  book: BookSummary
  checkpoints: Checkpoint[]
  members: Member[]
  me: Member
  busy?: boolean
  error?: string | null
}>()

const emit = defineEmits<{ change: [checkpointIndex: number] }>()

const current = computed(() => props.me.checkpointIndex)
const last = computed(() => props.checkpoints.length - 1)

const membersAt = (index: number) =>
  props.members.filter((member) => member.checkpointIndex === index)

function stepState(index: number) {
  if (index < current.value) return 'read'
  if (index === current.value) return 'current'
  return 'ahead'
}

function move(index: number) {
  if (props.busy || index < 0 || index > last.value || index === current.value) return
  emit('change', index)
}
</script>

<template>
  <section class="progress card" aria-labelledby="progress-heading">
    <div class="book">
      <div class="book__cover" aria-hidden="true">
        <span>{{ book.title }}</span>
      </div>
      <div class="book__meta">
        <p class="eyebrow">{{ book.isCurrent ? 'Now reading' : 'Past book' }}</p>
        <h2 class="book__title">{{ book.title }}</h2>
        <p class="book__author">{{ book.author }}</p>
      </div>
    </div>

    <div class="controls">
      <div>
        <h3 id="progress-heading" class="controls__heading">Your checkpoint</h3>
        <p class="controls__current">{{ checkpoints[current]?.label }}</p>
      </div>
      <div class="controls__buttons">
        <button
          type="button"
          class="btn btn-ghost step-btn"
          :disabled="busy || current <= 0"
          aria-label="Move back one checkpoint"
          @click="move(current - 1)"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          class="btn btn-ghost step-btn"
          :disabled="busy || current >= last"
          aria-label="Move forward one checkpoint"
          @click="move(current + 1)"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>

    <ol class="steps" :class="{ 'steps--busy': busy }" aria-label="Book checkpoints">
      <li v-for="checkpoint in checkpoints" :key="checkpoint.id">
        <button
          type="button"
          class="step"
          :class="`step--${stepState(checkpoint.index)}`"
          :aria-current="checkpoint.index === current ? 'step' : undefined"
          :aria-label="`${checkpoint.label}${checkpoint.index === current ? ' (current)' : ''}. Set your checkpoint here.`"
          @click="move(checkpoint.index)"
        >
          <span class="step__marker" aria-hidden="true">
            <svg
              v-if="stepState(checkpoint.index) === 'read'"
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span class="step__label">{{ checkpoint.label }}</span>
          <span class="step__members">
            <MemberAvatar
              v-for="member in membersAt(checkpoint.index)"
              :key="member.id"
              :member-id="member.id"
              :name="member.name"
              size="sm"
              :title="member.name"
            />
          </span>
        </button>
      </li>
    </ol>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p class="hint">Tap a checkpoint to update your progress. Discussion unlocks as you read.</p>
  </section>
</template>

<style scoped>
.progress {
  padding: 1.1rem;
  display: grid;
  gap: 1rem;
}

.book {
  display: flex;
  gap: 0.9rem;
  align-items: center;
}

.book__cover {
  flex: none;
  display: grid;
  place-items: end start;
  width: 3.6rem;
  height: 5.1rem;
  padding: 0.4rem;
  border-radius: 4px 8px 8px 4px;
  background:
    linear-gradient(90deg, rgb(0 0 0 / 18%) 0 4px, transparent 4px),
    linear-gradient(160deg, #3b6f60, #1f3d35);
  color: #f3ead8;
  font-family: var(--font-serif);
  font-size: 0.55rem;
  font-weight: 700;
  line-height: 1.15;
  box-shadow: 0 6px 14px rgb(31 61 53 / 30%);
}

.book__meta {
  min-width: 0;
}

.book__title {
  font-size: 1.25rem;
}

.book__author {
  color: var(--ink-2);
  font-size: 0.9375rem;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
}

.controls__heading {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-2);
}

.controls__current {
  font-family: var(--font-serif);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent);
}

.controls__buttons {
  display: flex;
  gap: 0.4rem;
}

.step-btn {
  width: 40px;
  padding: 0;
  background: var(--surface);
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
}

.step {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 44px;
  padding: 0.35rem 0.5rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.step:hover {
  background: var(--surface-2);
}

/* Connector line between markers. */
li:not(:last-child) .step::after {
  content: '';
  position: absolute;
  left: calc(0.5rem + 0.6875rem - 1px);
  top: calc(50% + 0.6875rem);
  height: calc(100% - 1.375rem);
  width: 2px;
  background: var(--line);
}

li:not(:last-child) .step--read::after {
  background: var(--accent);
}

.step__marker {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  border: 2px solid var(--line);
  background: var(--surface);
  color: var(--accent-ink);
}

.step--read .step__marker {
  background: var(--accent);
  border-color: var(--accent);
}

.step--current .step__marker {
  border-color: var(--accent);
  box-shadow:
    inset 0 0 0 3px var(--surface),
    inset 0 0 0 10px var(--accent);
}

.step__label {
  flex: 1;
  font-size: 0.9375rem;
}

.step--current .step__label {
  font-weight: 700;
}

.step--ahead .step__label {
  color: var(--ink-3);
}

.step__members {
  display: flex;
}

.step__members > * + * {
  margin-left: -0.35rem;
}

.steps--busy {
  opacity: 0.6;
  pointer-events: none;
}

.hint {
  font-size: 0.8125rem;
  color: var(--ink-3);
}
</style>
