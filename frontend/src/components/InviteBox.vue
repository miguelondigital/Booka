<script setup lang="ts">
import { computed, ref } from 'vue'

/** Invite link + code with copy; owners can reset it. */
const props = defineProps<{
  code: string
  canReset: boolean
  reset: () => Promise<unknown>
}>()

const copied = ref<'link' | 'code' | null>(null)
const resetting = ref(false)
const error = ref<string | null>(null)
const link = computed(() => `${window.location.origin}/join/${props.code}`)

async function copy(kind: 'link' | 'code') {
  error.value = null
  try {
    await navigator.clipboard.writeText(kind === 'link' ? link.value : props.code)
    copied.value = kind
    setTimeout(() => (copied.value = null), 2000)
  } catch {
    error.value = 'Copying is blocked in this browser. Select the text and copy it instead.'
  }
}

async function onReset() {
  if (
    !confirm('Reset the invite link? The current link and code will stop working for new members.')
  )
    return
  resetting.value = true
  error.value = null
  try {
    await props.reset()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not reset the invite.'
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div class="invite-box">
    <div class="field">
      <label for="invite-link">Invite link</label>
      <div class="invite-box__row">
        <input
          id="invite-link"
          class="input"
          :value="link"
          readonly
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button type="button" class="btn btn-primary btn-sm" @click="copy('link')">
          {{ copied === 'link' ? 'Copied!' : 'Copy link' }}
        </button>
      </div>
    </div>
    <p class="invite-box__code">
      Or share the code <code>{{ code }}</code>
      <button type="button" class="btn btn-quiet btn-sm" @click="copy('code')">
        {{ copied === 'code' ? 'Copied!' : 'Copy code' }}
      </button>
    </p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="canReset">
      <button type="button" class="btn btn-ghost btn-sm" :disabled="resetting" @click="onReset">
        {{ resetting ? 'Resetting…' : 'Reset invite link' }}
      </button>
      <span class="muted"> Use this if the link was shared too widely.</span>
    </div>
  </div>
</template>

<style scoped>
.invite-box {
  display: grid;
  gap: 0.6rem;
}

.invite-box__row {
  display: flex;
  gap: 0.5rem;
}

.invite-box__row .input {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
}

.invite-box__code {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--ink-2);
}

.invite-box__code code {
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  font-size: 0.875rem;
  letter-spacing: 0.06em;
}
</style>
