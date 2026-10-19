import { Router } from 'express'
import { requireAccount } from '../auth/sessions.js'
import type { ClubService } from '../services/clubs.js'
import { bookField, stringField } from './fields.js'

/** Clubs, owner tools and invites. All require a signed-in member. */
export function clubsRouter(clubs: ClubService): Router {
  const router = Router()

  // Homepage cards for every club you belong to.
  router.get('/clubs', async (_req, res) => {
    res.json({ clubs: await clubs.listCards(requireAccount(res).id) })
  })

  router.post('/clubs', async (req, res) => {
    const book = (req.body as { book?: unknown } | undefined)?.book
    const card = await clubs.createClub(requireAccount(res).id, {
      name: stringField(req.body, 'name'),
      book: bookField(book),
    })
    res.status(201).json(card)
  })

  router.get('/clubs/:clubId', async (req, res) => {
    res.json(await clubs.getDetail(req.params.clubId, requireAccount(res).id))
  })

  router.patch('/clubs/:clubId', async (req, res) => {
    await clubs.rename(req.params.clubId, requireAccount(res).id, stringField(req.body, 'name'))
    res.status(204).end()
  })

  router.delete('/clubs/:clubId', async (req, res) => {
    await clubs.deleteClub(req.params.clubId, requireAccount(res).id)
    res.status(204).end()
  })

  router.post('/clubs/:clubId/invite/reset', async (req, res) => {
    res.json({ inviteCode: await clubs.resetInvite(req.params.clubId, requireAccount(res).id) })
  })

  // Start the next book (owner).
  router.post('/clubs/:clubId/books', async (req, res) => {
    const book = await clubs.startBook(
      req.params.clubId,
      requireAccount(res).id,
      bookField(req.body),
    )
    res.status(201).json(book)
  })

  router.post('/clubs/:clubId/leave', async (req, res) => {
    res.json(await clubs.leave(req.params.clubId, requireAccount(res).id))
  })

  router.post('/clubs/:clubId/owner', async (req, res) => {
    await clubs.transferOwnership(
      req.params.clubId,
      requireAccount(res).id,
      stringField(req.body, 'memberId'),
    )
    res.status(204).end()
  })

  // Remove a member; they are blocked from rejoining until unblocked.
  router.delete('/clubs/:clubId/members/:memberId', async (req, res) => {
    await clubs.removeMember(req.params.clubId, requireAccount(res).id, req.params.memberId)
    res.status(204).end()
  })

  router.delete('/clubs/:clubId/blocks/:memberId', async (req, res) => {
    await clubs.unblock(req.params.clubId, requireAccount(res).id, req.params.memberId)
    res.status(204).end()
  })

  router.get('/invites/:code', async (req, res) => {
    res.json(await clubs.previewInvite(req.params.code, requireAccount(res).id))
  })

  router.post('/invites/:code/join', async (req, res) => {
    res.json(await clubs.joinWithInvite(req.params.code, requireAccount(res).id))
  })

  return router
}
