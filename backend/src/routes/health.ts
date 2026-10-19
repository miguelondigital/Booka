import { Router } from 'express'
import type { PrismaClient } from '../generated/prisma/client.js'

export function healthRouter(prisma: PrismaClient): Router {
  const router = Router()

  // Is the server running?
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) })
  })

  // Can Prisma reach PostgreSQL?
  router.get('/health/db', async (_req, res) => {
    try {
      const started = performance.now()
      await prisma.$queryRaw`SELECT 1`
      res.json({
        status: 'ok',
        database: 'connected',
        latencyMs: Math.round(performance.now() - started),
      })
    } catch (error) {
      console.error('[health/db] database check failed:', error)
      res.status(503).json({
        status: 'error',
        database: 'unreachable',
        message: 'Could not connect to PostgreSQL.',
      })
    }
  })

  return router
}
