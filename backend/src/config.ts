import { resolve } from 'node:path'
import { repoRoot } from './env.js'
import type { DataSource } from '../../shared/types.js'

function readDataSource(value = 'demo'): DataSource {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'demo' || normalized === 'db') return normalized
  throw new Error(`DATA_SOURCE must be "demo" or "db" (got "${value}").`)
}

export interface AppConfig {
  port: number
  dataSource: DataSource
  databaseUrl: string | undefined
  /** Built Vue app served in production. */
  clientDist: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT) || 3000,
    dataSource: readDataSource(env.DATA_SOURCE),
    databaseUrl: env.DATABASE_URL || undefined,
    clientDist: resolve(repoRoot, 'frontend/dist'),
  }
}
