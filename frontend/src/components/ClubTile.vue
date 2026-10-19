<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { ClubCard } from '@shared/types'
import { plural } from '@/format'
import ProgressTrack from './ProgressTrack.vue'

/** A homepage card: one club, its current book, and where everyone is. */
const props = defineProps<{ club: ClubCard; meId: string }>()

const book = computed(() => props.club.currentBook)
const myLabel = computed(() =>
  book.value && props.club.myCheckpointIndex !== null
    ? book.value.checkpointLabels[props.club.myCheckpointIndex]
    : undefined,
)
const others = computed(() => props.club.members.filter((member) => member.id !== props.meId))
const ahead = computed(
  () =>
    others.value.filter((member) => member.checkpointIndex > (props.club.myCheckpointIndex ?? 0))
      .length,
)
</script>

<template>
  <article class="tile card">
    <header class="tile__header">
      <h2 class="tile__name">
        <RouterLink :to="{ name: 'club', params: { clubId: club.id } }" class="tile__link">
          {{ club.name }}
        </RouterLink>
      </h2>
      <span v-if="club.isOwner" class="badge badge--accent">Owner</span>
    </header>

    <template v-if="book">
      <div class="tile__book">
        <div class="tile__cover" aria-hidden="true">
          <span>{{ book.title }}</span>
        </div>
        <div>
          <p class="tile__title">{{ book.title }}</p>
          <p class="muted">{{ book.author }}</p>
        </div>
      </div>

      <p class="tile__me">
        You're at <strong>{{ myLabel ?? 'the start' }}</strong>
        <span class="muted">
          · {{ (club.myCheckpointIndex ?? 0) + 1 }} of {{ book.checkpointCount }}
        </span>
      </p>
      <ProgressTrack :labels="book.checkpointLabels" :members="club.members" :me-id="meId" />
      <p class="muted">
        {{ plural(club.memberCount, 'member') }}
        <template v-if="others.length">
          ·
          {{
            ahead === 0
              ? 'nobody is ahead of you'
              : `${ahead} ${ahead === 1 ? 'is' : 'are'} further along`
          }}
        </template>
      </p>
    </template>
    <p v-else class="muted">No book yet.</p>
  </article>
</template>

<style scoped>
.tile {
  position: relative;
  display: grid;
  gap: 0.75rem;
  padding: 1.1rem 1.15rem 1rem;
  transition:
    border-color 0.15s ease,
    transform 0.15s ease;
}

.tile:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
}

.tile__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tile__name {
  font-size: 1.2rem;
  min-width: 0;
}

.tile__link {
  color: inherit;
  text-decoration: none;
}

/* The whole card is clickable through the title link. */
.tile__link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius);
}

.tile__link:focus-visible {
  outline: none;
}

.tile:has(.tile__link:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.tile__book {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tile__cover {
  flex: none;
  display: grid;
  place-items: end start;
  width: 2.6rem;
  height: 3.7rem;
  padding: 0.3rem;
  border-radius: 3px 6px 6px 3px;
  background:
    linear-gradient(90deg, rgb(0 0 0 / 18%) 0 3px, transparent 3px),
    linear-gradient(160deg, #3b6f60, #1f3d35);
  color: #f3ead8;
  font-family: var(--font-serif);
  font-size: 0.45rem;
  font-weight: 700;
  line-height: 1.1;
  overflow: hidden;
}

.tile__title {
  font-family: var(--font-serif);
  font-weight: 600;
}

.tile__me {
  font-size: 0.9375rem;
}
</style>
