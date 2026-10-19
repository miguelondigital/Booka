import type {
  LoginInput,
  NewBookInput,
  NewReplyInput,
  NewThreadInput,
  SignupInput,
} from './types.js'

export const LIMITS = {
  titleMax: 120,
  bodyMax: 4000,
  nameMax: 40,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 200,
  clubNameMax: 60,
  bookTitleMax: 120,
  authorMax: 80,
  checkpointLabelMax: 60,
  checkpointsMin: 2,
  checkpointsMax: 40,
  chaptersMax: 300,
} as const

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Returns an error message, or null when the input is valid. */
export function validateName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Tell the club what to call you.'
  if (trimmed.length > LIMITS.nameMax) return `Names can be at most ${LIMITS.nameMax} characters.`
  return null
}

/** Returns an error message, or null when the input is valid. */
export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email)
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > LIMITS.emailMax)
    return 'Enter a valid email address.'
  return null
}

/** Returns an error message, or null when the input is valid. */
export function validateSignupInput(input: SignupInput): string | null {
  const problem = validateName(input.name) ?? validateEmail(input.email)
  if (problem) return problem
  if (input.password.length < LIMITS.passwordMin)
    return `Passwords need at least ${LIMITS.passwordMin} characters.`
  if (input.password.length > LIMITS.passwordMax)
    return `Passwords can be at most ${LIMITS.passwordMax} characters.`
  return null
}

/** Returns an error message, or null when the input is valid. */
export function validateLoginInput(input: LoginInput): string | null {
  if (!normalizeEmail(input.email)) return 'Enter your email address.'
  if (!input.password) return 'Enter your password.'
  if (input.password.length > LIMITS.passwordMax) return 'Email or password is incorrect.'
  return null
}

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

/** Returns an error message, or null when the input is valid. */
export function validateClubName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Give your club a name.'
  if (trimmed.length > LIMITS.clubNameMax)
    return `Club names can be at most ${LIMITS.clubNameMax} characters.`
  return null
}

/** Returns an error message, or null when the input is valid. */
export function validateBookInput(input: NewBookInput): string | null {
  const title = input.title.trim()
  const author = input.author.trim()
  if (!title) return 'Enter the book title.'
  if (title.length > LIMITS.bookTitleMax)
    return `Titles can be at most ${LIMITS.bookTitleMax} characters.`
  if (!author) return 'Enter the author.'
  if (author.length > LIMITS.authorMax)
    return `Author names can be at most ${LIMITS.authorMax} characters.`
  const labels = input.checkpoints.map((label) => label.trim())
  if (labels.length < LIMITS.checkpointsMin)
    return `A book needs at least ${LIMITS.checkpointsMin} checkpoints.`
  if (labels.length > LIMITS.checkpointsMax)
    return `A book can have at most ${LIMITS.checkpointsMax} checkpoints.`
  if (labels.some((label) => !label)) return 'Every checkpoint needs a name.'
  if (labels.some((label) => label.length > LIMITS.checkpointLabelMax))
    return `Checkpoint names can be at most ${LIMITS.checkpointLabelMax} characters.`
  return null
}

/** Invite codes are shown upper-case; accept any case, spaces or dashes. */
export function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
