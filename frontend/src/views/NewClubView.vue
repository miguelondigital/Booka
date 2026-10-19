<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { NewBookInput } from '@shared/types'
import { LIMITS, validateBookInput, validateClubName } from '@shared/validation'
import { api } from '@/data/api'
import BookSetupForm from '@/components/BookSetupForm.vue'

const router = useRouter()
const name = ref('')
const book = reactive<NewBookInput>({ title: '', author: '', checkpoints: [] })
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  error.value = validateClubName(name.value) ?? validateBookInput(book)
  if (error.value) return
  submitting.value = true
  try {
    const club = await api.createClub({ name: name.value, book })
    await router.replace({ name: 'club', params: { clubId: club.id } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not create the club.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page page--narrow">
    <RouterLink :to="{ name: 'home' }" class="back-link">← Your clubs</RouterLink>
    <header class="page-header">
      <div>
        <h1 class="page-title">Create a book club</h1>
        <p class="page-lede">You'll be the owner. Invite people with a link once it's set up.</p>
      </div>
    </header>

    <form class="section card" novalidate @submit.prevent="onSubmit">
      <div class="field">
        <label for="club-name">Club name</label>
        <input
          id="club-name"
          v-model="name"
          class="input"
          :maxlength="LIMITS.clubNameMax"
          placeholder="e.g. Thursday Night Readers"
          autocomplete="off"
        />
      </div>

      <h2 class="section__title">First book</h2>
      <BookSetupForm v-model:book="book" />

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="actions">
        <RouterLink :to="{ name: 'home' }" class="btn btn-quiet">Cancel</RouterLink>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? 'Creating…' : 'Create club' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
