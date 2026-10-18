import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express, { type ErrorRequestHandler } from 'express'
import type { AppConfig } from './config.js'
import { getPrisma } from './db/client.js'
import { HttpError } from './errors.js'
import type { ClubRepository } from './repositories/clubRepository.js'
import { createFixtureRepository } from './repositories/fixtureRepository.js'
import { createPrismaRepository } from './repositories/prismaRepository.js'
import { clubRouter } from './routes/club.js'
import { healthRouter } from './routes/health.js'

function createRepository({ dataSource, databaseUrl }: AppConfig): ClubRepository {
  if (dataSource === 'demo') return createFixtureRepository()
  if (!databaseUrl) throw new Error('DATA_SOURCE=db requires DATABASE_URL to be set.')
  return createPrismaRepository(getPrisma(databaseUrl))
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  // Malformed JSON bodies from express.json().
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'Request body must be valid JSON.' })
    return
  }
  console.error(error)
  res.status(500).json({ error: 'Something went wrong.' })
}

export function createApp(config: AppConfig) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.use('/api', healthRouter(config.dataSource, config.databaseUrl))
  app.use('/api', clubRouter(config.dataSource, createRepository(config)))
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' })
  })

  // Production: serve the built Vue app; unknown paths fall back to index.html.
  const indexHtml = join(config.clientDist, 'index.html')
  if (existsSync(indexHtml)) {
    app.use(express.static(config.clientDist))
    app.get('/{*path}', (_req, res) => res.sendFile(indexHtml))
  }

  app.use(errorHandler)
  return app
}
