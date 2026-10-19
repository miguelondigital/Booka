<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { InvitePreview } from '@shared/types'
import { api } from '@/data/api'
import { plural } from '@/format'

const props = defineProps<{ code: string }>()
const router = useRouter()

const preview = ref<InvitePreview | null>(null)
const error = ref<string | null>(null)
const joining = ref(false)

onMounted(async () => {
  try {
    preview.value = await api.previewInvite(props.code)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
})

async function join() {
  if (!preview.value) return
  joining.value = true
  error.value = null
  try {
    const { clubId } = await api.joinWithInvite(props.code)
    await router.replace({ name: 'club', params: { clubId } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not join the club.'
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="page page--narrow">
    <div v-if="!preview && !error" class="state" role="status">
      <span class="spinner" aria-hidden="true"></span>
      Checking your invite…
    </div>

    <div v-else-if="!preview" class="state card state--column" role="alert">
      <h2>Invite not found</h2>
      <p>{{ error }}</p>
      <RouterLink :to="{ name: 'home' }" class="btn btn-ghost">Go to your clubs</RouterLink>
    </div>

    <section v-else class="invite card" aria-labelledby="invite-heading">
      <p class="eyebrow">You're invited to</p>
      <h1 id="invite-heading" class="invite__name">{{ preview.club.name }}</h1>
      <p class="page-lede">
        <template v-if="preview.currentBook">
          Reading <strong>{{ preview.currentBook.title }}</strong> by
          {{ preview.currentBook.author }} ·
        </template>
        {{ plural(preview.memberCount, 'member') }}
      </p>

      <p v-if="preview.blocked" class="form-error" role="alert">
        You were removed from this club and can't rejoin with this link. Ask the owner if you think
        this is a mistake.
      </p>
      <template v-else-if="preview.alreadyMember">
        <p class="form-success">You're already a member.</p>
        <RouterLink
          :to="{ name: 'club', params: { clubId: preview.club.id } }"
          class="btn btn-primary"
        >
          Open the club
        </RouterLink>
      </template>
      <template v-else>
        <p class="muted">You'll start at the first checkpoint. Discussion unlocks as you read.</p>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button type="button" class="btn btn-primary" :disabled="joining" @click="join">
          {{ joining ? 'Joining…' : 'Join club' }}
        </button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.invite {
  display: grid;
  justify-items: start;
  gap: 0.75rem;
  margin-top: 2rem;
  padding: 1.75rem 1.5rem;
}

.invite__name {
  font-size: 1.8rem;
}
</style>
