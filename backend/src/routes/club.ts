import { Router, type Request } from 'express'
import type { DataSource, DemoPayload } from '../../../shared/types.js'
import { badRequest } from '../errors.js'
import type { ClubRepository } from '../repositories/clubRepository.js'

/**
 * Demo identity: the acting member is named in the X-Member-Id header.
 * This is NOT authentication; it stands in for a real session until auth exists.
 */
function actingMemberId(req: Request): string {
  const memberId = req.get('x-member-id')?.trim()
  if (!memberId) throw badRequest('Missing X-Member-Id header.')
  return memberId
}

function stringField(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[field]
  return typeof value === 'string' ? value : ''
}

export function clubRouter(dataSource: DataSource, repository: ClubRepository): Router {
  const router = Router()

  // Club, book, checkpoints, members and discussion. NOTE: discussion is
  // returned unfiltered and filtered by the client (see shared/visibility.ts);
  // this is a demo, not a security boundary.
  router.get('/demo', async (_req, res) => {
    const payload: DemoPayload = { dataSource, ...(await repository.getSnapshot()) }
    res.json(payload)
  })

  router.get('/clubs/:id', async (req, res) => {
    res.json(await repository.getClub(req.params.id))
  })

  router.put('/progress/me', async (req, res) => {
    const checkpointIndex = (req.body as { checkpointIndex?: unknown } | undefined)?.checkpointIndex
    if (typeof checkpointIndex !== 'number') throw badRequest('checkpointIndex must be a number.')
    res.json(await repository.updateProgress(actingMemberId(req), checkpointIndex))
  })

  // Only title/body are read from the request; any checkpoint the client
  // sends is ignored and the server stamps the author's current progress.
  router.post('/threads', async (req, res) => {
    const thread = await repository.createThread(actingMemberId(req), {
      title: stringField(req.body, 'title'),
      body: stringField(req.body, 'body'),
    })
    res.status(201).json(thread)
  })

  router.post('/threads/:id/posts', async (req, res) => {
    const reply = await repository.createReply(actingMemberId(req), req.params.id, {
      body: stringField(req.body, 'body'),
    })
    res.status(201).json(reply)
  })

  return router
}
