<script setup lang="ts">
import { storeToRefs } from 'pinia'
import AppHeader from './components/AppHeader.vue'
import { useClubStore } from './stores/club'

const { club, dataSource, status } = storeToRefs(useClubStore())
</script>

<template>
  <AppHeader :club-name="club?.name" :data-source="status === 'ready' ? dataSource : undefined" />
  <main>
    <RouterView />
  </main>
</template>
