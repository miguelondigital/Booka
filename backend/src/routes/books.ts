import { Router } from 'express'
import { requireAccount } from '../auth/sessions.js'
import type { BookService } from '../services/books.js'
import { stringField } from './fields.js'

/** One book of a club: overview, discussion, progress, posting. Members only. */
export function booksRouter(books: BookService): Router {
  const router = Router()
  const base = '/clubs/:clubId/books/:bookId'

  router.get(base, async (req, res) => {
    const { clubId, bookId } = req.params
    res.json(await books.getOverview(clubId, bookId, requireAccount(res).id))
  })

  // Filtered on the server for the signed-in member's checkpoint in this book.
  router.get(`${base}/discussion`, async (req, res) => {
    const { clubId, bookId } = req.params
    res.json(await books.getDiscussion(clubId, bookId, requireAccount(res).id))
  })

  router.put(`${base}/progress`, async (req, res) => {
    const { clubId, bookId } = req.params
    const { checkpointIndex } = (req.body ?? {}) as { checkpointIndex?: unknown }
    res.json(await books.updateProgress(clubId, bookId, requireAccount(res).id, checkpointIndex))
  })

  // Only title/body are read; the server stamps the author's checkpoint.
  router.post(`${base}/threads`, async (req, res) => {
    const { clubId, bookId } = req.params
    const thread = await books.createThread(clubId, bookId, requireAccount(res).id, {
      title: stringField(req.body, 'title'),
      body: stringField(req.body, 'body'),
    })
    res.status(201).json(thread)
  })

  router.post(`${base}/threads/:threadId/replies`, async (req, res) => {
    const { clubId, bookId, threadId } = req.params
    const reply = await books.createReply(clubId, bookId, requireAccount(res).id, threadId, {
      body: stringField(req.body, 'body'),
    })
    res.status(201).json(reply)
  })

  return router
}
