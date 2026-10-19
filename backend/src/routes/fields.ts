import type { NewBookInput } from '../../../shared/types.js'

type Body = Record<string, unknown> | undefined

/** Read a string field from a JSON body; anything else becomes ''. */
export function stringField(body: unknown, field: string): string {
  const value = (body as Body)?.[field]
  return typeof value === 'string' ? value : ''
}

/** Read a book from a JSON body: { title, author, checkpoints: string[] }. */
export function bookField(body: unknown): NewBookInput {
  const checkpoints = (body as Body)?.checkpoints
  return {
    title: stringField(body, 'title'),
    author: stringField(body, 'author'),
    checkpoints: Array.isArray(checkpoints)
      ? checkpoints.map((label) => (typeof label === 'string' ? label : ''))
      : [],
  }
}
