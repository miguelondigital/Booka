import type { NewReplyInput, NewThreadInput } from './types.js'

export const LIMITS = {
  titleMax: 120,
  bodyMax: 4000,
} as const

/** Returns an error message, or null when the input is valid. */
export function validateThreadInput(input: NewThreadInput): string | null {
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title) return 'Give your thread a title.'
  if (title.length > LIMITS.titleMax) return `Titles can be at most ${LIMITS.titleMax} characters.`
  if (!body) return 'Write something to start the discussion.'
  if (body.length > LIMITS.bodyMax) return `Posts can be at most ${LIMITS.bodyMax} characters.`
  return null
}

/** Returns an error message, or null when the input is valid. */
export function validateReplyInput(input: NewReplyInput): string | null {
  const body = input.body.trim()
  if (!body) return 'Write a reply first.'
  if (body.length > LIMITS.bodyMax) return `Replies can be at most ${LIMITS.bodyMax} characters.`
  return null
}

export function isCheckpointIndex(value: unknown, checkpointCount: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < checkpointCount
}
