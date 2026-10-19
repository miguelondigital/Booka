import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Account, LoginInput, SignupInput } from '@shared/types'
import { api } from '@/data/api'

export const useAuthStore = defineStore('auth', () => {
  const account = ref<Account | null>(null)
  let loaded: Promise<void> | null = null

  /** Resolve the current session once (used by the router guard). */
  function ensureLoaded(): Promise<void> {
    loaded ??= api
      .me()
      .then((current) => {
        account.value = current
      })
      .catch(() => {
        // Server unreachable: treat as signed out; the sign-in form reports errors.
        account.value = null
        loaded = null
      })
    return loaded
  }

  async function login(input: LoginInput) {
    account.value = await api.login(input)
  }

  async function signup(input: SignupInput) {
    account.value = await api.signup(input)
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      account.value = null
    }
  }

  /** After the account's name or email changed. */
  function setAccount(next: Account) {
    account.value = next
  }

  /** The server rejected our session (expired or signed out elsewhere). */
  function sessionEnded() {
    account.value = null
  }

  return { account, ensureLoaded, login, signup, logout, setAccount, sessionEnded }
})
