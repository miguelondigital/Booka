/** An API error with the HTTP status, so callers can react to 401/404. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

let onUnauthorized: (() => void) | undefined

/** Called when a request fails because the session ended (set once in main.ts). */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Don't trigger the global sign-out handler on 401 (auth endpoints). */
  allowUnauthorized?: boolean
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { accept: 'application/json' }
  // The API only accepts JSON writes (its CSRF guard), so always send a JSON body.
  const body = method === 'GET' ? null : JSON.stringify(options.body ?? {})
  if (body !== null) headers['content-type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(path, { method, headers, body, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'Could not reach Booka. Check your connection and try again.')
  }

  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && !options.allowUnauthorized) onUnauthorized?.()
    const message = (data as { error?: unknown } | null)?.error
    throw new ApiError(
      response.status,
      typeof message === 'string'
        ? message
        : response.status >= 500
          ? `Booka is unavailable right now (HTTP ${response.status}). Try again shortly.`
          : `Request failed (HTTP ${response.status}).`,
    )
  }
  return data as T
}
