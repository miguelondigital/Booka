import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import { createSessionStore } from './auth/sessions.js'
import type { AppConfig } from './config.js'
import { getPrisma } from './db/client.js'
import { HttpError } from './errors.js'
import { accountRouter } from './routes/account.js'
import { authRouter } from './routes/auth.js'
import { booksRouter } from './routes/books.js'
import { clubsRouter } from './routes/clubs.js'
import { healthRouter } from './routes/health.js'
import { createAccountService } from './services/accounts.js'
import { createBookService } from './services/books.js'
import { createClubService } from './services/clubs.js'

/**
 * Writes must be JSON. Cross-site HTML forms cannot send application/json
 * without a CORS preflight, so together with SameSite=Lax session cookies
 * this blocks cross-site request forgery.
 */
const requireJsonWrites: RequestHandler = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    res.status(415).json({ error: 'Requests must be sent as JSON.' })
    return
  }
  next()
}

/** API responses are personal to the signed-in member: never cache them. */
const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
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
  const prisma = getPrisma(config.databaseUrl)
  const sessions = createSessionStore(prisma, config)
  const accounts = createAccountService(prisma)
  const books = createBookService(prisma)
  const clubs = createClubService(prisma, books)

  const app = express()
  app.disable('x-powered-by')
  // Render (and most hosts) terminate TLS at a proxy in front of the app.
  app.set('trust proxy', 1)

  app.use('/api', noStore, requireJsonWrites, express.json({ limit: '32kb' }))
  app.use('/api', healthRouter(prisma))
  app.use('/api', sessions.authenticate())
  app.use('/api', authRouter(accounts, sessions))
  app.use('/api', accountRouter(accounts, sessions))
  app.use('/api', clubsRouter(clubs))
  app.use('/api', booksRouter(books))
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
