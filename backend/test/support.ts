import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../src/app.js'

/** Password the test seed gives the demo accounts (test database only). */
export const TEST_PASSWORD = 'test-password-123'

export async function startTestServer(databaseUrl: string) {
  const app = createApp({
    port: 0,
    databaseUrl,
    clientDist: '/nonexistent',
    secureCookies: false,
    sessionTtlDays: 30,
  })
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening))
  })
  const { port } = server.address() as AddressInfo
  return { server, baseUrl: `http://127.0.0.1:${port}` }
}

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

/** A tiny browser stand-in: sends JSON and keeps the session cookie. */
export function createClient(baseUrl: string) {
  let cookie = ''
  async function request(
    path: string,
    { method = 'GET', body, headers = {} }: RequestOptions = {},
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? null : JSON.stringify(body),
    })
    for (const setCookie of response.headers.getSetCookie()) {
      const pair = setCookie.split(';')[0] ?? ''
      cookie = pair.endsWith('=') ? '' : pair
    }
    return response
  }
  return {
    request,
    get cookie() {
      return cookie
    },
    set cookie(value: string) {
      cookie = value
    },
    login: (email: string, password = TEST_PASSWORD) =>
      request('/api/auth/login', { method: 'POST', body: { email, password } }),
  }
}
