import { resolve } from 'node:path'
import { repoRoot } from './env.js'

export interface AppConfig {
  port: number
  databaseUrl: string
  /** Built Vue app served in production. */
  clientDist: string
  /** Send the session cookie only over HTTPS (on in production). */
  secureCookies: boolean
  sessionTtlDays: number
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and point it at PostgreSQL.',
    )
  }
  return {
    port: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL,
    clientDist: resolve(repoRoot, 'frontend/dist'),
    secureCookies: env.NODE_ENV === 'production',
    sessionTtlDays: Number(env.SESSION_TTL_DAYS) || 30,
  }
}
