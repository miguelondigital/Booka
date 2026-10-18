import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

let client: PrismaClient | undefined

/** Lazily create one shared Prisma client, so demo mode never needs a database. */
export function getPrisma(databaseUrl: string): PrismaClient {
  client ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  return client
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect()
  client = undefined
}
