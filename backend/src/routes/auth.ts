import { Router } from 'express'
import { requireAccount, sessionToken, type SessionStore } from '../auth/sessions.js'
import type { AccountService } from '../services/accounts.js'
import { stringField } from './fields.js'

export function authRouter(accounts: AccountService, sessions: SessionStore): Router {
  const router = Router()

  router.post('/auth/signup', async (req, res) => {
    const account = await accounts.signup({
      name: stringField(req.body, 'name'),
      email: stringField(req.body, 'email'),
      password: stringField(req.body, 'password'),
    })
    await sessions.start(res, account.id)
    res.status(201).json({ account })
  })

  router.post('/auth/login', async (req, res) => {
    const account = await accounts.login({
      email: stringField(req.body, 'email'),
      password: stringField(req.body, 'password'),
    })
    await sessions.start(res, account.id)
    res.json({ account })
  })

  router.post('/auth/logout', async (req, res) => {
    await sessions.end(res, sessionToken(req.headers.cookie))
    res.status(204).end()
  })

  router.get('/auth/me', (_req, res) => {
    res.json({ account: requireAccount(res) })
  })

  return router
}
