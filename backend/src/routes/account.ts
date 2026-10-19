import { Router } from 'express'
import { requireAccount, sessionToken, type SessionStore } from '../auth/sessions.js'
import type { AccountService } from '../services/accounts.js'
import { stringField } from './fields.js'

/** The signed-in member's own account. */
export function accountRouter(accounts: AccountService, sessions: SessionStore): Router {
  const router = Router()

  router.get('/account', async (_req, res) => {
    res.json(await accounts.profile(requireAccount(res).id))
  })

  router.patch('/account', async (req, res) => {
    const account = await accounts.updateName(requireAccount(res).id, stringField(req.body, 'name'))
    res.json({ account })
  })

  router.put('/account/email', async (req, res) => {
    const account = await accounts.changeEmail(
      requireAccount(res).id,
      stringField(req.body, 'email'),
      stringField(req.body, 'password'),
    )
    res.json({ account })
  })

  router.delete('/account', async (req, res) => {
    await accounts.deleteAccount(requireAccount(res).id, stringField(req.body, 'password'))
    await sessions.end(res, sessionToken(req.headers.cookie))
    res.status(204).end()
  })

  return router
}
