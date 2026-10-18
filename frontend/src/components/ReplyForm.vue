<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { LIMITS, validateReplyInput } from '@shared/validation'

const props = defineProps<{
  threadId: string
  authorName: string
  checkpointLabel: string
  submit: (body: string) => Promise<unknown>
}>()

const open = ref(false)
const body = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const textarea = ref<HTMLTextAreaElement | null>(null)

async function start() {
  open.value = true
  await nextTick()
  textarea.value?.focus()
}

function cancel() {
  open.value = false
  body.value = ''
  error.value = null
}

async function onSubmit() {
  error.value = validateReplyInput({ body: body.value })
  if (error.value) return
  submitting.value = true
  try {
    await props.submit(body.value)
    cancel()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not post the reply.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <button v-if="!open" type="button" class="btn btn-ghost reply-start" @click="start">
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
      <path d="M9 17 4 12l5-5" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
    Reply
  </button>
  <form v-else class="reply-form" novalidate @submit.prevent="onSubmit">
    <label class="sr-only" :for="`reply-${threadId}`">Your reply</label>
    <textarea
      :id="`reply-${threadId}`"
      ref="textarea"
      v-model="body"
      class="input"
      rows="3"
      :maxlength="LIMITS.bodyMax"
      :placeholder="`Reply as ${authorName}…`"
      @keydown.esc="cancel"
    ></textarea>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="reply-form__footer">
      <span class="stamp"
        >Tagged <span class="chip">{{ checkpointLabel }}</span></span
      >
      <div class="reply-form__actions">
        <button type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? 'Posting…' : 'Post reply' }}
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.reply-start {
  min-height: 36px;
  padding: 0.35rem 0.9rem;
  font-size: 0.875rem;
}

.reply-form {
  display: grid;
  gap: 0.6rem;
}

.reply-form__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.stamp {
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.reply-form__actions {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}
</style>
