<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <header class="header">
    <h1 class="header__title">{{ title ?? 'Scrappy' }}</h1>
    <p class="header_end">Sign up</p>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #ddd;
  background: #fafafa;
}

.header__title {
  margin: 0;
  font-size: 1.5rem;
}

.header_end{
    margin-left:auto;
}
</style>
