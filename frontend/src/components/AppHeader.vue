<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Account } from '@shared/types'
import MemberAvatar from './MemberAvatar.vue'

defineProps<{ account?: Account | null | undefined }>()
const emit = defineEmits<{ logout: [] }>()
</script>

<template>
  <header class="header">
    <div class="header__inner">
      <RouterLink :to="{ name: 'home' }" class="brand" aria-label="Booka home">
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
      </RouterLink>
      <div v-if="account" class="account">
        <RouterLink :to="{ name: 'account' }" class="account__link" title="Your account">
          <MemberAvatar :member-id="account.id" :name="account.name" />
          <span class="account__name">{{ account.name }}</span>
        </RouterLink>
        <button type="button" class="btn btn-quiet account__logout" @click="emit('logout')">
          Sign out
        </button>
      </div>
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
  color: inherit;
  text-decoration: none;
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

.account {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.account__link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.2rem 0.6rem 0.2rem 0.2rem;
  border-radius: 999px;
  color: inherit;
  text-decoration: none;
}

.account__link:hover,
.account__link.router-link-active {
  background: var(--surface-2);
}

.account__name {
  font-weight: 600;
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 12rem;
}

.account__logout {
  min-height: 36px;
  font-size: 0.875rem;
}

@media (max-width: 520px) {
  .account__name {
    display: none;
  }

  .account__link {
    padding-right: 0.2rem;
  }
}
</style>
