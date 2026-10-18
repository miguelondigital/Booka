<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { NewThreadInput } from '@shared/types'
import { LIMITS, validateThreadInput } from '@shared/validation'

const props = defineProps<{
  authorName: string
  checkpointLabel: string
  submit: (input: NewThreadInput) => Promise<unknown>
}>()

const emit = defineEmits<{ done: [] }>()

const title = ref('')
const body = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)

onMounted(() => nextTick(() => titleInput.value?.focus()))

async function onSubmit() {
  const input = { title: title.value, body: body.value }
  error.value = validateThreadInput(input)
  if (error.value) return
  submitting.value = true
  try {
    await props.submit(input)
    title.value = ''
    body.value = ''
    emit('done')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not post the thread.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="new-thread card" novalidate @submit.prevent="onSubmit">
    <div class="field">
      <label for="thread-title">Title</label>
      <input
        id="thread-title"
        ref="titleInput"
        v-model="title"
        class="input"
        :maxlength="LIMITS.titleMax"
        placeholder="What do you want to talk about?"
        autocomplete="off"
      />
    </div>
    <div class="field">
      <label for="thread-body">Post</label>
      <textarea
        id="thread-body"
        v-model="body"
        class="input"
        rows="4"
        :maxlength="LIMITS.bodyMax"
        placeholder="Share a thought, a question, a favourite line…"
      ></textarea>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="new-thread__footer">
      <p class="stamp">
        Posting as <strong>{{ authorName }}</strong
        >, tagged
        <span class="chip">{{ checkpointLabel }}</span>
        <span class="stamp__why">so only readers who reached it will see it.</span>
      </p>
      <div class="new-thread__actions">
        <button type="button" class="btn btn-quiet" @click="emit('done')">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? 'Posting…' : 'Post thread' }}
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.new-thread {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
}

.new-thread__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.stamp {
  font-size: 0.8125rem;
  color: var(--ink-2);
  flex: 1 1 240px;
}

.stamp__why {
  color: var(--ink-3);
}

.new-thread__actions {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}
</style>
