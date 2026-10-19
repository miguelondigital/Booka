<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { LIMITS, validateLoginInput, validateSignupInput } from '@shared/validation'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ mode: 'login' | 'signup' }>()

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

const isSignup = computed(() => props.mode === 'signup')
const showDemoHint = import.meta.env.DEV

watch(
  () => props.mode,
  () => (error.value = null),
)

/** Only follow same-site, path-only redirects. */
function redirectTarget(): string {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/'
}

async function onSubmit() {
  error.value = isSignup.value
    ? validateSignupInput({ name: name.value, email: email.value, password: password.value })
    : validateLoginInput({ email: email.value, password: password.value })
  if (error.value) return
  submitting.value = true
  try {
    if (isSignup.value) {
      await auth.signup({ name: name.value, email: email.value, password: password.value })
    } else {
      await auth.login({ email: email.value, password: password.value })
    }
    password.value = ''
    await router.replace(redirectTarget())
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Something went wrong. Try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth">
    <section class="auth__panel card" :aria-labelledby="`${mode}-heading`">
      <p class="eyebrow">Spoiler-safe book clubs</p>
      <h1 :id="`${mode}-heading`" class="auth__title">
        {{ isSignup ? 'Join your book club' : 'Welcome back' }}
      </h1>
      <p class="auth__lede">Discussion unlocks as you read, so nobody spoils the ending for you.</p>

      <form class="auth__form" novalidate @submit.prevent="onSubmit">
        <div v-if="isSignup" class="field">
          <label for="auth-name">Name</label>
          <input
            id="auth-name"
            v-model="name"
            class="input"
            autocomplete="name"
            :maxlength="LIMITS.nameMax"
            required
          />
        </div>
        <div class="field">
          <label for="auth-email">Email</label>
          <input
            id="auth-email"
            v-model="email"
            class="input"
            type="email"
            autocomplete="email"
            inputmode="email"
            :maxlength="LIMITS.emailMax"
            required
          />
        </div>
        <div class="field">
          <label for="auth-password">Password</label>
          <input
            id="auth-password"
            v-model="password"
            class="input"
            type="password"
            :autocomplete="isSignup ? 'new-password' : 'current-password'"
            :minlength="isSignup ? LIMITS.passwordMin : undefined"
            :maxlength="LIMITS.passwordMax"
            required
          />
          <p v-if="isSignup" class="field__hint">At least {{ LIMITS.passwordMin }} characters.</p>
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn btn-primary auth__submit" :disabled="submitting">
          {{
            submitting
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : isSignup
                ? 'Create account'
                : 'Sign in'
          }}
        </button>
      </form>

      <p class="auth__switch">
        <template v-if="isSignup">
          Already have an account?
          <RouterLink :to="{ name: 'login', query: route.query }">Sign in</RouterLink>
        </template>
        <template v-else>
          New here?
          <RouterLink :to="{ name: 'signup', query: route.query }">Create an account</RouterLink>
        </template>
      </p>

      <p v-if="showDemoHint && !isSignup" class="auth__demo">
        Development: demo accounts <code>maya@</code>, <code>jordan@</code>, <code>riley@</code> and
        <code>sam@example.com</code> sign in with the <code>DEMO_PASSWORD</code> from your
        <code>.env</code> (after <code>npm run db:seed</code>).
      </p>
    </section>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  place-items: start center;
  padding: 3rem 1rem;
}

.auth__panel {
  width: min(100%, 420px);
  padding: 1.75rem 1.5rem;
  display: grid;
  gap: 0.75rem;
}

.auth__title {
  font-size: 1.75rem;
}

.auth__lede {
  color: var(--ink-2);
}

.auth__form {
  display: grid;
  gap: 0.9rem;
  margin-top: 0.5rem;
}

.field__hint {
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.auth__submit {
  width: 100%;
  margin-top: 0.25rem;
}

.auth__switch {
  text-align: center;
  font-size: 0.9375rem;
  color: var(--ink-2);
}

.auth__switch a {
  color: var(--accent);
  font-weight: 600;
}

.auth__demo {
  font-size: 0.8125rem;
  color: var(--ink-3);
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.auth__demo code {
  font-size: 0.75rem;
}
</style>
