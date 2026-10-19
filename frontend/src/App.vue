<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import { useAuthStore } from './stores/auth'
import { useClubStore } from './stores/club'

const auth = useAuthStore()
const clubStore = useClubStore()
const router = useRouter()
const { account } = storeToRefs(auth)

async function logout() {
  await auth.logout()
  clubStore.$reset()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <AppHeader :account="account" @logout="logout" />
  <main>
    <RouterView />
  </main>
</template>
