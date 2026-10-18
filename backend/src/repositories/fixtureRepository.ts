import { demoFixtures } from '../../../shared/fixtures.js'
import { HttpError, notFound } from '../errors.js'
import type { ClubRepository } from './clubRepository.js'

const demoWrite = () =>
  new HttpError(
    409,
    'The server is running with DATA_SOURCE=demo: progress and new posts are saved in the browser. Set DATA_SOURCE=db to save them in PostgreSQL.',
  )

/** DATA_SOURCE=demo: read-only fixtures. The browser persists demo changes. */
export function createFixtureRepository(): ClubRepository {
  return {
    async getSnapshot() {
      return structuredClone(demoFixtures)
    },
    async getClub(clubId) {
      if (clubId !== demoFixtures.club.id) throw notFound('Club not found.')
      const { club, book, checkpoints } = structuredClone(demoFixtures)
      return { club, book, checkpoints }
    },
    async updateProgress() {
      throw demoWrite()
    },
    async createThread() {
      throw demoWrite()
    },
    async createReply() {
      throw demoWrite()
    },
  }
}
