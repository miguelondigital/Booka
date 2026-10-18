import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Repository root. Works from both backend/src (tsx) and backend/dist (built). */
export const repoRoot = resolve(import.meta.dirname, '../..')

// Load the root .env for local development. Variables that are already set
// (e.g. by Render or the shell) take precedence over the file.
const envFile = resolve(repoRoot, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)
