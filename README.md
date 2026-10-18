# Booka: spoiler-safe book club MVP

Book clubs lose members to pace mismatch. A reader who falls behind skips the discussion to
avoid spoilers, and may quietly drop out. Booka ties what you can see in the discussion to your
**reading checkpoint**, so an uneven reading pace is normal.

This is a **demonstrable prototype**: one club, one book, three seeded members at different
checkpoints. Switch between members and the same discussion looks different to each of them.
Move a member forward and more of the conversation unlocks.

> **Not a security boundary.** In this MVP the visibility filter runs in the browser, on
> self-reported progress, over data the client has already received. It demonstrates the product
> behaviour only. A production version must apply the same rule on the server before any post
> data is returned (see [Future work](#future-work)).

## Quick start

Requires Node `^22.18` or `>=24.12`.

```bash
npm install
npm run dev
```

Open http://localhost:5173. No account, database, or `.env` is needed for demo mode. Vite serves
the Vue app on port 5173 and proxies `/api` to Express on port 3000.

To try it:

1. Use **View as member** to switch between Maya, Jordan, and Riley.
2. Move the active member's checkpoint with the arrows or by tapping a checkpoint. The feed
   updates immediately.
3. Start a thread or reply. New posts are tagged with the author's current checkpoint.
4. Switch to a member who is further behind. The new post is hidden, and any later replies show
   only as "Some replies are hidden until you reach a later checkpoint." with a count.
5. Refresh. Progress and new posts are kept. **Reset demo data** in the footer restores the
   fixtures.

## The visibility rule

```
post.checkpointIndex <= currentMember.checkpointIndex
```

The rule applies to threads and replies alike. It lives in one place,
[`shared/visibility.ts`](shared/visibility.ts):

- `isVisibleAt(itemIndex, readerIndex)` is the comparison itself.
- `buildVisibleFeed(threads, readerIndex)` returns visible threads with only their visible
  replies, plus a `hiddenReplyCount`. Hidden replies are reduced to that number: no body, author,
  id, or timestamp survives. Thread ordering also uses visible activity only.

The Pinia store exposes only `visibleFeed`. It never exposes the unfiltered threads, so no
component can apply its own filter or render hidden content. The API uses the same function to
refuse replies to a thread beyond the author's checkpoint.

**Stamping:** a new thread or reply's checkpoint always comes from the author's stored progress.
Neither the demo repository nor the API accepts a checkpoint from the caller. Any checkpoint the
client sends is ignored.

### Acceptance tests

| Test | Expected | Covered by |
| --- | --- | --- |
| Member at checkpoint 1 | No posts/replies from checkpoints 2–5 | `frontend/src/__tests__/visibility.spec.ts` |
| Member at checkpoint 3 | Sees posts/replies from 0–3 | `visibility.spec.ts` |
| Member at checkpoint 5 | Sees all seeded posts and replies | `visibility.spec.ts` |
| New post | Uses the author's checkpoint; caller can't choose | `demoRepository.spec.ts`, `backend/test/api.test.ts` (DB) |
| Hidden replies | Only a neutral message + count; nothing else leaks | `visibility.spec.ts`, `clubStore.spec.ts` |
| Progress change | Visible feed updates immediately | `clubStore.spec.ts` |
| Refresh | Demo progress and new posts survive | `demoRepository.spec.ts` |

```bash
npm test                                   # frontend + backend tests
TEST_DATABASE_URL="$DATABASE_URL" npm test -w backend   # also runs the DB-mode API tests
```

The DB-mode tests need a migrated and seeded database. They delete the rows they create and
restore the progress they change.

## Data modes

Set `DATA_SOURCE` in `.env` (copy from [`.env.example`](.env.example)):

| `DATA_SOURCE` | Behaviour |
| --- | --- |
| `demo` (default) | `GET /api/demo` serves the fixtures in [`shared/fixtures.ts`](shared/fixtures.ts). Progress changes and new posts are saved in the browser (`localStorage`). |
| `db` | Club, book, checkpoints, members, threads, and replies are loaded from PostgreSQL through Express + Prisma. Progress and new posts are saved there too. |

The client asks `GET /api/demo` which mode the server runs in and picks a repository to match.
`frontend/src/data/demoRepository.ts` (localStorage) and `frontend/src/data/apiRepository.ts`
(HTTP) implement the same `ClubRepository` interface. Components never know which one is
active.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATA_SOURCE` | no (default `demo`) | `demo` or `db`, see above |
| `DATABASE_URL` | for `db` mode, `db:*` scripts, `/api/health/db` | PostgreSQL connection string |
| `PORT` | no (default `3000`) | Express port. Render sets it automatically. |

Commit `.env.example` only. Never commit `.env` or a real `DATABASE_URL`.

## Database

The schema is in [`prisma/schema.prisma`](prisma/schema.prisma): `Club`, `Book`, `Checkpoint`,
`Member`, `Membership`, `Progress`, `Thread`, `Post` (a reply).

- Club 1-to-1 active Book, and Book 1-to-many Checkpoints, with `@@unique([bookId, index])`.
- Member to Club through `Membership`, and Member to Book through `Progress` (current checkpoint).
- Thread belongs to a Checkpoint. Post belongs to a Thread and a Checkpoint.

With a local PostgreSQL:

```bash
cp .env.example .env          # then set DATABASE_URL
npm run db:migrate            # apply migrations (prisma migrate dev)
npm run db:seed               # idempotent: safe to re-run
npm run db:verify             # connectivity, migrations, seed, and a visibility check
```

The seed upserts the fixture records by fixed id. Re-running it restores those records,
including the seeded members' progress, to their fixture values. Posts created in the app are
kept.

`db:verify` exits non-zero on failure and prints what each member can currently see:

```
✔ Connected to PostgreSQL
✔ Migrations applied — 1 migration(s)
✔ Book has 6–8 ordered checkpoints (indexes 0..n-1) — 0:Chapters 1-2, …, 5:Ending
…
│ 'Maya'   │ '1 (Chapters 3-4)' │ 2 │ 2  │ 3 │ 'none' │
│ 'Jordan' │ '3 (Chapters 7-8)' │ 4 │ 6  │ 4 │ 'none' │
│ 'Riley'  │ '5 (Ending)'       │ 6 │ 10 │ 0 │ 'none' │
```

Then set `DATA_SOURCE=db` and run `npm run dev`. The header badge reads **Database mode**.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Server is running (also reports `dataSource`) |
| GET | `/api/health/db` | Prisma can reach PostgreSQL (`503` if not configured or unreachable) |
| GET | `/api/demo` | Club, book, checkpoints, members, discussion, and `dataSource` |
| GET | `/api/clubs/:id` | Club, active book, and checkpoints |
| PUT | `/api/progress/me` | `{ checkpointIndex }`, sets the acting member's progress |
| POST | `/api/threads` | `{ title, body }`, stamped with the author's progress |
| POST | `/api/threads/:id/posts` | `{ body }`, a reply stamped with the author's progress |

Write endpoints identify the acting member with an `X-Member-Id` header. This is a demo stand-in
for a session, **not authentication**. In `demo` mode they return `409`, because demo writes
live in the browser.

## Project structure

```
package.json        npm workspaces + shared dev/build/start/db scripts
prisma.config.ts    Prisma 7 config (schema, migrations, seed command)
prisma/             schema.prisma, migrations/, seed.ts, verify.ts
shared/             types, demo fixtures, visibility rule, input validation
backend/            Express API (TypeScript); serves frontend/dist in production
  src/repositories/ fixtureRepository (demo) and prismaRepository (db)
frontend/           Vue 3 + Vite + Pinia client
  src/data/         ClubRepository boundary: demo (localStorage) and API implementations
  src/stores/       club store; exposes only the filtered feed
render.yaml         Render blueprint (web service + PostgreSQL)
```

The spec suggests `client/` and `server/`. This repo keeps its existing `frontend/` and
`backend/` names, with the same roles.

The Prisma client is generated into `backend/src/generated/` on `npm install` (gitignored). The
backend is type-checked with `tsc` and bundled with esbuild into `backend/dist/server.js`, which
pulls in `shared/`.

### Scripts (repo root)

| Script | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch, :3000) + Vite (:5173) together |
| `npm run build` | Type-check and build the Vue app, then type-check and bundle the server |
| `npm start` | `node backend/dist/server.js`: serves `/api` and `frontend/dist` |
| `npm test` | Frontend and backend tests (Vitest) |
| `npm run db:migrate` / `db:deploy` | `prisma migrate dev` / `prisma migrate deploy` |
| `npm run db:seed` / `db:verify` | Idempotent seed / database verification |

## Hosting on Render

One Node web service plus one managed PostgreSQL database. [`render.yaml`](render.yaml) describes
both. You can use it as a Blueprint, or set things up by hand:

1. Push the repository to GitHub.
2. Create a Render PostgreSQL database.
3. Create a Render Web Service connected to the repository (runtime: Node).
4. Set the environment variables `DATABASE_URL` (the database's internal connection string) and
   `DATA_SOURCE=db`.
5. Build command: `npm ci && npm run build`
6. Pre-deploy command: `npx prisma migrate deploy`. Pre-deploy needs a paid instance. On the
   free instance, use the build command
   `npm ci && npm run build && npx prisma migrate deploy` instead.
7. Start command: `npm start`. The server listens on Render's `PORT` and serves both the Vue app
   and `/api`.
8. Seed once from the service's Shell tab: `npm run db:seed`, then optionally `npm run db:verify`.
9. Open the public URL and check `https://<your-service>.onrender.com/api/health/db`.

Notes:

- Don't set `NODE_ENV=production` during the build. `npm ci` would then skip the dev
  dependencies (Vite, TypeScript, esbuild) that the build needs.
- `prisma` and `tsx` are regular dependencies, so migrations and the seed can run on the server.

## Out of scope (by design)

Real registration and login, invites, multiple clubs, notifications, search, catch-up summaries,
scheduling, moderation, progress privacy, payments, external book APIs, and production-grade
authorization.

## Future work

1. Database-backed progress and discussion as the default.
2. Real authentication and club membership, replacing `X-Member-Id`.
3. Invite codes and multiple clubs.
4. **Server-enforced visibility on every read path**: run `buildVisibleFeed` (or an
   equivalent query) on the server for the authenticated member, and return only hidden counts.
5. Catch-up summaries and spoiler-safe notifications.
6. Progress history and reading forecasts.

"The Salt Orchard" and its author are fictional, so the demo discussion can include real
spoilers.
