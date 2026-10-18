<script setup lang="ts">
import type { Member } from '@shared/types'
import MemberAvatar from './MemberAvatar.vue'

defineProps<{
  members: Member[]
  activeMemberId: string | undefined
  checkpointLabel: (index: number) => string
}>()

const emit = defineEmits<{ select: [memberId: string] }>()
</script>

<template>
  <fieldset class="switcher">
    <legend class="eyebrow">View as member</legend>
    <div class="switcher__options">
      <label
        v-for="member in members"
        :key="member.id"
        class="option"
        :class="{ 'option--active': member.id === activeMemberId }"
      >
        <input
          class="sr-only"
          type="radio"
          name="active-member"
          :value="member.id"
          :aria-label="`${member.name}, at ${checkpointLabel(member.checkpointIndex)}`"
          :checked="member.id === activeMemberId"
          @change="emit('select', member.id)"
        />
        <MemberAvatar :member-id="member.id" :name="member.name" />
        <span class="option__text">
          <span class="option__name">{{ member.name }}</span>
          <span class="option__checkpoint">{{ checkpointLabel(member.checkpointIndex) }}</span>
        </span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.switcher {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

.switcher legend {
  padding: 0;
  margin-bottom: 0.5rem;
}

.switcher__options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  grid-auto-flow: column;
  gap: 0.4rem;
  padding: 0.3rem;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--line);
}

.option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
  padding: 0.55rem 0.4rem;
  text-align: center;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.option:hover {
  background: color-mix(in srgb, var(--surface) 60%, transparent);
}

.option--active {
  background: var(--surface);
  border-color: var(--line);
  box-shadow: var(--shadow);
}

.option:has(input:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.option__text {
  display: grid;
  min-width: 0;
  line-height: 1.25;
}

.option__name {
  font-weight: 600;
  font-size: 0.9375rem;
}

.option__checkpoint {
  font-size: 0.75rem;
  color: var(--ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
