<script setup lang="ts">
import type { DataSource } from '@shared/types'

defineProps<{ clubName?: string | undefined; dataSource?: DataSource | undefined }>()
</script>

<template>
  <header class="header">
    <div class="header__inner">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z"
            />
            <path d="M12 6.5v13" />
          </svg>
        </span>
        <span class="brand__name">Booka</span>
        <span v-if="clubName" class="brand__club">{{ clubName }}</span>
      </div>
      <span
        v-if="dataSource"
        class="mode"
        :class="`mode--${dataSource}`"
        :title="
          dataSource === 'demo'
            ? 'Demo mode: progress and new posts are saved in this browser.'
            : 'Database mode: progress and posts are saved in PostgreSQL.'
        "
      >
        <span class="mode__dot" aria-hidden="true"></span>
        {{ dataSource === 'demo' ? 'Demo mode' : 'Database mode' }}
      </span>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}

.header__inner {
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 1160px;
  margin: 0 auto;
  padding: 0.75rem 1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  background: var(--accent);
  color: var(--accent-ink);
}

.brand__name {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  font-weight: 700;
}

.brand__club {
  color: var(--ink-3);
  font-size: 0.9375rem;
  padding-left: 0.6rem;
  border-left: 1px solid var(--line);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-2);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.mode__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--veil);
}

.mode--db .mode__dot {
  background: var(--accent);
}

@media (max-width: 520px) {
  .brand__club {
    display: none;
  }
}
</style>
