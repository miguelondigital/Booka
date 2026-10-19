<script setup lang="ts">
import { computed } from 'vue'
import type { Member } from '@shared/types'
import MemberAvatar from './MemberAvatar.vue'

/** A compact bar of a book's checkpoints with each member's position on it. */
const props = defineProps<{
  labels: string[]
  members: Member[]
  meId: string
}>()

const count = computed(() => Math.max(props.labels.length, 1))
const me = computed(() => props.members.find((member) => member.id === props.meId))
const fill = computed(() => (me.value ? ((me.value.checkpointIndex + 1) / count.value) * 100 : 0))

/** Members grouped by checkpoint, so avatars at the same spot can stack. */
const markers = computed(() => {
  const groups = new Map<number, Member[]>()
  for (const member of props.members) {
    groups.set(member.checkpointIndex, [...(groups.get(member.checkpointIndex) ?? []), member])
  }
  return [...groups.entries()].map(([index, group]) => ({
    index,
    left: ((index + 0.5) / count.value) * 100,
    group,
  }))
})

const label = (index: number) => props.labels[index] ?? `Checkpoint ${index + 1}`
</script>

<template>
  <div class="track">
    <div class="track__bar" aria-hidden="true">
      <span class="track__fill" :style="{ width: `${fill}%` }"></span>
      <span
        v-for="index in count - 1"
        :key="index"
        class="track__tick"
        :style="{ left: `${(index / count) * 100}%` }"
      ></span>
    </div>
    <div class="track__markers" aria-hidden="true">
      <span
        v-for="marker in markers"
        :key="marker.index"
        class="track__marker"
        :style="{ left: `${marker.left}%` }"
        :title="marker.group.map((member) => `${member.name}: ${label(marker.index)}`).join('\n')"
      >
        <MemberAvatar
          v-for="member in marker.group"
          :key="member.id"
          :member-id="member.id"
          :name="member.name"
          size="sm"
          :class="{ track__me: member.id === meId }"
        />
      </span>
    </div>
    <ul class="sr-only">
      <li v-for="member in members" :key="member.id">
        {{ member.id === meId ? 'You' : member.name }}: {{ label(member.checkpointIndex) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.track {
  position: relative;
  padding-bottom: 1.6rem;
}

.track__bar {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  overflow: hidden;
}

.track__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
  border-radius: 999px;
}

.track__tick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--line) 70%, transparent);
}

.track__markers {
  position: absolute;
  left: 0;
  right: 0;
  top: 0.65rem;
}

.track__marker {
  position: absolute;
  display: flex;
  transform: translateX(-50%);
}

.track__marker > * + * {
  margin-left: -0.4rem;
}

.track__me {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 4px var(--accent);
}
</style>
