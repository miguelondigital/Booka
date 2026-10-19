import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AccountView from '@/views/AccountView.vue'
import AuthView from '@/views/AuthView.vue'
import ClubSettingsView from '@/views/ClubSettingsView.vue'
import ClubView from '@/views/ClubView.vue'
import HomeView from '@/views/HomeView.vue'
import JoinView from '@/views/JoinView.vue'
import NewBookView from '@/views/NewBookView.vue'
import NewClubView from '@/views/NewClubView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    title?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    {
      path: '/account',
      name: 'account',
      component: AccountView,
      meta: { requiresAuth: true, title: 'Your account' },
    },
    {
      path: '/clubs/new',
      name: 'new-club',
      component: NewClubView,
      meta: { requiresAuth: true, title: 'Create a club' },
    },
    {
      path: '/join/:code',
      name: 'join',
      component: JoinView,
      props: true,
      meta: { requiresAuth: true, title: 'Join a club' },
    },
    {
      path: '/clubs/:clubId',
      name: 'club',
      component: ClubView,
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/clubs/:clubId/settings',
      name: 'club-settings',
      component: ClubSettingsView,
      props: true,
      meta: { requiresAuth: true, title: 'Club settings' },
    },
    {
      path: '/clubs/:clubId/books/new',
      name: 'new-book',
      component: NewBookView,
      props: true,
      meta: { requiresAuth: true, title: 'Start the next book' },
    },
    {
      path: '/clubs/:clubId/books/:bookId',
      name: 'club-book',
      component: ClubView,
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: AuthView,
      props: { mode: 'login' },
      meta: { guestOnly: true, title: 'Sign in' },
    },
    {
      path: '/signup',
      name: 'signup',
      component: AuthView,
      props: { mode: 'signup' },
      meta: { guestOnly: true, title: 'Create an account' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.ensureLoaded()
  if (to.meta.requiresAuth && !auth.account) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.account) return { name: 'home' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Booka` : 'Booka'
})

export default router
