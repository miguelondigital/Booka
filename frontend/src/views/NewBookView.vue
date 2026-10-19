<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { ClubDetail, NewBookInput } from '@shared/types'
import { validateBookInput } from '@shared/validation'
import { api } from '@/data/api'
import BookSetupForm from '@/components/BookSetupForm.vue'

const props = defineProps<{ clubId: string }>()
const router = useRouter()

const detail = ref<ClubDetail | null>(null)
const loadError = ref<string | null>(null)
const book = reactive<NewBookInput>({ title: '', author: '', checkpoints: [] })
const error = ref<string | null>(null)
const submitting = ref(false)

onMounted(async () => {
  try {
    detail.value = await api.clubDetail(props.clubId)
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : String(cause)
  }
})

async function onSubmit() {
  error.value = validateBookInput(book)
  if (error.value) return
  const current = detail.value?.books.find((candidate) => candidate.isCurrent)
  if (
    current &&
    !confirm(
      `Start "${book.title.trim()}"? "${current.title}" becomes a past book: its discussion stays open.`,
    )
  )
    return
  submitting.value = true
  try {
    await api.startBook(props.clubId, book)
    await router.replace({ name: 'club', params: { clubId: props.clubId } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not start the book.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page page--narrow">
    <RouterLink :to="{ name: 'club-settings', params: { clubId } }" class="back-link">
      ← Club settings
    </RouterLink>

    <div v-if="loadError" class="state card state--column" role="alert">
      <h2>We couldn't load this club</h2>
      <p>{{ loadError }}</p>
    </div>

    <div v-else-if="detail && !detail.isOwner" class="state card state--column">
      <h2>Only the club owner can start the next book</h2>
    </div>

    <template v-else-if="detail">
      <header class="page-header">
        <div>
          <h1 class="page-title">Start the next book</h1>
          <p class="page-lede">
            {{ detail.club.name }} will move on to this book. Everyone starts at its first
            checkpoint, and earlier books stay browsable.
          </p>
        </div>
      </header>

      <form class="section card" novalidate @submit.prevent="onSubmit">
        <BookSetupForm v-model:book="book" />
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="actions">
          <RouterLink :to="{ name: 'club-settings', params: { clubId } }" class="btn btn-quiet">
            Cancel
          </RouterLink>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? 'Starting…' : 'Start book' }}
          </button>
        </div>
      </form>
    </template>

    <div v-else class="state" role="status">
      <span class="spinner" aria-hidden="true"></span>
      Loading…
    </div>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
