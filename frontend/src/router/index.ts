import { createRouter, createWebHistory } from 'vue-router'
import ClubView from '@/views/ClubView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'club', component: ClubView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
