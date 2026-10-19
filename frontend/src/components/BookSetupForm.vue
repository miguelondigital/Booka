<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NewBookInput } from '@shared/types'
import { suggestCheckpoints } from '@shared/checkpoints'
import { LIMITS } from '@shared/validation'

/**
 * Book title, author and checkpoints. Checkpoints are suggested from the
 * chapter count, then the owner can rename, add or remove them.
 * Fields only: the parent form validates and submits.
 */
const book = defineModel<NewBookInput>('book', { required: true })

const chapterCount = ref(10)
const perCheckpoint = ref(2)
// Once the owner edits the list by hand, stop regenerating it automatically.
const edited = ref(false)

function suggest() {
  const chapters = Math.min(Math.max(Math.floor(chapterCount.value) || 0, 1), LIMITS.chaptersMax)
  book.value.checkpoints = suggestCheckpoints(chapters, perCheckpoint.value).slice(
    -LIMITS.checkpointsMax,
  )
  edited.value = false
}

watch([chapterCount, perCheckpoint], () => {
  if (!edited.value) suggest()
})

if (book.value.checkpoints.length === 0) suggest()

function rename(index: number, label: string) {
  book.value.checkpoints[index] = label
  edited.value = true
}

function remove(index: number) {
  book.value.checkpoints.splice(index, 1)
  edited.value = true
}

function insertAfter(index: number) {
  book.value.checkpoints.splice(index + 1, 0, '')
  edited.value = true
}

function regenerate() {
  if (edited.value && !confirm('Replace your edited checkpoints with fresh suggestions?')) return
  suggest()
}
</script>

<template>
  <div class="book-setup">
    <div class="form-row">
      <div class="field">
        <label for="book-title">Book title</label>
        <input
          id="book-title"
          v-model="book.title"
          class="input"
          :maxlength="LIMITS.bookTitleMax"
          autocomplete="off"
        />
      </div>
      <div class="field">
        <label for="book-author">Author</label>
        <input
          id="book-author"
          v-model="book.author"
          class="input"
          :maxlength="LIMITS.authorMax"
          autocomplete="off"
        />
      </div>
    </div>

    <fieldset class="checkpoints">
      <legend class="checkpoints__legend">Checkpoints</legend>
      <p class="section__hint">
        Discussion is tagged with the poster's checkpoint, and members only see what they've
        reached. Checkpoints can't be changed once the book is saved.
      </p>

      <div class="form-row">
        <div class="field field--small">
          <label for="book-chapters">Chapters</label>
          <input
            id="book-chapters"
            v-model.number="chapterCount"
            class="input"
            type="number"
            min="1"
            :max="LIMITS.chaptersMax"
            inputmode="numeric"
          />
        </div>
        <div class="field field--small">
          <label for="book-group">Chapters per checkpoint</label>
          <select id="book-group" v-model.number="perCheckpoint" class="input">
            <option v-for="size in [1, 2, 3, 4, 5]" :key="size" :value="size">{{ size }}</option>
          </select>
        </div>
        <button type="button" class="btn btn-ghost" @click="regenerate">Suggest checkpoints</button>
      </div>

      <ol class="checkpoints__list">
        <li v-for="(label, index) in book.checkpoints" :key="index" class="checkpoint-row">
          <span class="checkpoint-row__number" aria-hidden="true">{{ index + 1 }}</span>
          <label class="sr-only" :for="`checkpoint-${index}`"
            >Checkpoint {{ index + 1 }} name</label
          >
          <input
            :id="`checkpoint-${index}`"
            class="input"
            :value="label"
            :maxlength="LIMITS.checkpointLabelMax"
            placeholder="Checkpoint name"
            @input="rename(index, ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="btn btn-quiet btn-sm"
            :aria-label="`Add a checkpoint after checkpoint ${index + 1}`"
            :disabled="book.checkpoints.length >= LIMITS.checkpointsMax"
            title="Add a checkpoint below"
            @click="insertAfter(index)"
          >
            +
          </button>
          <button
            type="button"
            class="btn btn-quiet btn-sm"
            :aria-label="`Remove checkpoint ${index + 1}`"
            :disabled="book.checkpoints.length <= LIMITS.checkpointsMin"
            title="Remove"
            @click="remove(index)"
          >
            ×
          </button>
        </li>
      </ol>
    </fieldset>
  </div>
</template>

<style scoped>
.book-setup {
  display: grid;
  gap: 1rem;
}

.checkpoints {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.checkpoints__legend {
  padding: 0;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--ink-2);
}

.field--small {
  flex: 0 1 180px !important;
}

.checkpoints__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.checkpoint-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.checkpoint-row__number {
  flex: none;
  width: 1.6rem;
  text-align: right;
  color: var(--ink-3);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.checkpoint-row .input {
  flex: 1;
  min-width: 0;
  padding-block: 0.45rem;
}

.checkpoint-row .btn {
  width: 34px;
  padding: 0;
  font-size: 1.1rem;
}
</style>
