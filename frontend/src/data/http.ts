interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  /** Demo identity sent as X-Member-Id. Not authentication. */
  memberId?: string
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.memberId) headers['x-member-id'] = options.memberId

  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
    })
  } catch {
    throw new Error('Could not reach the Booka server. Check that it is running.')
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = (data as { error?: unknown } | null)?.error
    if (typeof message === 'string') throw new Error(message)
    throw new Error(
      response.status >= 500
        ? `The Booka server is unavailable (HTTP ${response.status}). Check that it is running.`
        : `Request failed (HTTP ${response.status}).`,
    )
  }
  return data as T
}
