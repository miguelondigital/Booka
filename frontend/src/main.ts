import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from './data/http'
import { useAuthStore } from './stores/auth'
import { useClubStore } from './stores/club'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Session expired or ended elsewhere: clear local state and ask to sign in again.
setUnauthorizedHandler(() => {
  useAuthStore().sessionEnded()
  useClubStore().$reset()
  const current = router.currentRoute.value
  if (current.meta.requiresAuth) {
    void router.replace({ name: 'login', query: { redirect: current.fullPath } })
  }
})

app.mount('#app')
