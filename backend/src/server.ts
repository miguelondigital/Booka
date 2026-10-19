import './env.js'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { disconnectPrisma } from './db/client.js'

const config = loadConfig()
const app = createApp(config)

const server = app.listen(config.port, () => {
  console.log(`Booka listening on http://localhost:${config.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => void disconnectPrisma().finally(() => process.exit(0)))
  })
}
