import { Router } from 'express'
import type { DataSource } from '../../../shared/types.js'
import { getPrisma } from '../db/client.js'

export function healthRouter(dataSource: DataSource, databaseUrl: string | undefined): Router {
  const router = Router()

  // Is the server running?
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', dataSource, uptimeSeconds: Math.round(process.uptime()) })
  })

  // Can Prisma reach PostgreSQL? Available in both data modes.
  router.get('/health/db', async (_req, res) => {
    if (!databaseUrl) {
      res
        .status(503)
        .json({ status: 'error', database: 'not_configured', message: 'DATABASE_URL is not set.' })
      return
    }
    try {
      const started = performance.now()
      await getPrisma(databaseUrl).$queryRaw`SELECT 1`
      res.json({
        status: 'ok',
        database: 'connected',
        latencyMs: Math.round(performance.now() - started),
      })
    } catch (error) {
      console.error('[health/db] database check failed:', error)
      res
        .status(503)
        .json({
          status: 'error',
          database: 'unreachable',
          message: 'Could not connect to PostgreSQL.',
        })
    }
  })

  return router
}
