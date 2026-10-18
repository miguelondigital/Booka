<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ memberId: string; name: string; size?: 'sm' | 'md' }>(), {
  size: 'md',
})

const palette = ['#c0643f', '#3e72a8', '#7a5bb0', '#2f7d62', '#b2853a', '#a34d6d']

const color = computed(() => {
  let hash = 0
  for (const char of props.memberId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
})
</script>

<template>
  <span
    class="avatar"
    :class="`avatar--${size}`"
    :style="{ backgroundColor: color }"
    aria-hidden="true"
  >
    {{ name.charAt(0).toUpperCase() }}
  </span>
</template>

<style scoped>
.avatar {
  display: inline-grid;
  place-items: center;
  flex: none;
  border-radius: 50%;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}

.avatar--md {
  width: 2rem;
  height: 2rem;
  font-size: 0.875rem;
}

.avatar--sm {
  width: 1.375rem;
  height: 1.375rem;
  font-size: 0.6875rem;
  box-shadow: 0 0 0 2px var(--surface);
}
</style>
