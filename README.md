# Booka: spoiler-safe book club

Book clubs lose members to pace mismatch. A reader who falls behind skips the discussion to
avoid spoilers, and may quietly drop out. Booka ties what you can see in the discussion to your
**reading checkpoint**, so an uneven reading pace is normal.

Members sign in, join clubs by invite, record where they are in each club's book, and talk in
threads. A thread or reply is only ever sent to members who have reached its checkpoint. The
server enforces this; the browser never receives hidden content.

## Quick start

Requires Node `^22.18` or `>=24.12` and PostgreSQL.

```bash
npm install
cp .env.example .env        # set DATABASE_URL (and DEMO_PASSWORD for demo logins)
npm run db:migrate          # apply migrations
npm run db:seed             # demo clubs, books, members and discussion
npm run dev
```

Open http://localhost:5173. Vite serves the Vue app on port 5173 and proxies `/api` to Express
on port 3000.

**Demo data.** The seed creates two clubs with fictional books:

| Club | Owner | Members | Books |
| --- | --- | --- | --- |
| Thursday Night Readers (invite `SALTORCH01`) | Riley | Maya, Jordan, Riley | *The Salt Orchard* |
| Harbour Lights Book Circle (invite `HARBOUR001`) | Maya | Maya, Riley, Sam | *Winter at Harrow Fen* (current), *The Glass Cartographer* (past) |

If `DEMO_PASSWORD` is set when you seed, `maya@`, `jordan@`, `riley@` and `sam@example.com` can
sign in with it. Maya is in both clubs, so her homepage shows two. Riley stopped partway through
the past book, so that book still hides its ending from Riley.

You can also **create an account**. New accounts start with an empty homepage: create a club or
join one with an invite code.

## Features

- **Homepage:** a card for every club you're in, showing the current book, your checkpoint, and
  where your club-mates are on a progress track. From here you can create a club or join one with
  an invite code or link.
- **Creating a club:** any signed-in user can create one and becomes its owner. Enter the book's
  title, author and chapter count. Booka suggests checkpoints (`shared/checkpoints.ts`, for
  example every 2 chapters plus "Ending"), which you can rename, add to, or remove before saving.
- **Invites:** each club has one invite link (`/join/CODE`) and code. Any member can see and
  share it; only the owner can reset it, which stops old links working. Opening a link while
  signed out sends you to sign in, then back to the invite.
- **Books and history:** a club reads one book at a time. The owner starts the next book, and
  everyone begins at its first checkpoint. Past books stay in the book switcher and remain open:
  you can keep posting and updating progress, and filtering still uses your progress in that book.
- **Owner tools** (club settings): start the next book, reset the invite, remove members, rename
  the club, delete it, and hand ownership to another member.
  - Removed members are blocked from rejoining until the owner unblocks them.
  - The owner must hand over ownership before leaving. If they're the only member, leaving
    deletes the club.
- **Account page:** edit your name. Change your email, which needs your current password. See your
  reading history across all clubs, and delete your account.
  - Deleting your account requires your password.
  - Clubs you own with other members must get a new owner first.
  - Clubs where you're the only member are deleted.
  - Your posts stay, shown as "Former member". The account is anonymised, not removed.
- **Leaving a club** keeps your posts and your progress, so rejoining restores it.

## The visibility rule

```
post.checkpointIndex <= currentMember.checkpointIndex
```

The rule applies to threads and replies alike. It lives in one place,
[`shared/visibility.ts`](shared/visibility.ts):

- `isVisibleAt(itemIndex, readerIndex)` is the comparison itself.
- `buildVisibleFeed(threads, readerIndex)` returns visible threads with only their visible
  replies, plus a `hiddenReplyCount`.

**Enforcement is on the server.** Every endpoint that returns discussion
(`GET …/discussion`, and `PUT …/progress`, which returns the new discussion) goes through
[`backend/src/services/books.ts`](backend/src/services/books.ts). That service loads the book's
threads and returns only `buildVisibleFeed(threads, member's stored checkpoint in that book)`. The
same applies to current and past books:

- Threads beyond your checkpoint are never sent.
- Hidden replies are sent only as a count. The UI shows "Some replies are hidden until you reach
  a later checkpoint." with that number. No body, author, id, or timestamp is sent, and thread
  ordering uses visible activity only.
- Replying to a thread beyond your checkpoint returns `404`, as if it didn't exist.

**Stamping:** a new thread or reply's checkpoint always comes from the author's progress stored
in the database. The API reads only `title` and `body`, so any checkpoint the client sends is
ignored.

## Accounts and sessions

- Passwords are hashed with scrypt (salted, with parameters stored per hash) using `node:crypto`.
  There are no extra dependencies.
- Signing in sets an `HttpOnly`, `SameSite=Lax` session cookie. It is also `Secure` when
  `NODE_ENV=production`. The cookie holds a random 256-bit token. Only its SHA-256 hash is
  stored in the `Session` table, and sessions expire after `SESSION_TTL_DAYS` (default 30).
- Sign-out deletes the session server-side, so a copied cookie stops working.
- A wrong password and an unknown email get the same response, with the same password-hashing
  work.
- **CSRF:** the API rejects writes that aren't `application/json` (HTTP `415`). Cross-site
  forms can't send JSON without a CORS preflight, and the cookie is `SameSite=Lax`.
- API responses are `Cache-Control: no-store`.
- **Membership:** every club and book endpoint checks that you belong to the club. Other clubs
  return `404`, so club ids can't be probed. Owner-only actions return `403` for members.

## Tests

```bash
npm test
```

- **Unit tests** (always run): the visibility acceptance matrix (`backend/test/visibility.test.ts`),
  password hashing, and the client store (`frontend/src/__tests__/clubStore.spec.ts`).
- **API integration tests** (`backend/test/integration/api.test.ts`) run when
  `TEST_DATABASE_URL` is set, for example in `.env`. It must point to a **separate, disposable**
  database: each run migrates it, wipes it, and seeds it. The suite refuses to run if
  `TEST_DATABASE_URL` equals `DATABASE_URL`.

| Acceptance test | Covered by (integration test, real HTTP + PostgreSQL) |
| --- | --- |
| Member at checkpoint 1 can't see checkpoints 2–5 | the response JSON contains no later titles, bodies, or ids |
| Member at checkpoint 3 sees 0–3 | exact set of checkpoint indexes returned |
| Member at checkpoint 5 sees everything | every seeded thread and reply is returned |
| New post uses the author's checkpoint | a client-sent `checkpointIndex: 5` is ignored, and the post is stamped 1 |
| Hidden replies are a count only | `hiddenReplyCount` is returned, the reply is not |
| Progress change updates the feed | `PUT /progress` returns the newly visible discussion |
| Past books keep filtering | Riley, partway through the past book, doesn't receive its ending |

The suite also covers sign-up, sign-in and sign-out, the homepage cards, creating clubs, invites,
resetting the invite, blocking removed members, the owner tools, starting the next book,
ownership transfer and leaving, account edits, account deletion, and parallel first visits to a
book.

`npm run db:verify` runs a similar check against your dev database. It calls the same service
the API uses, for every member of every book in every club.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NODE_ENV` | production | `production` makes the session cookie `Secure` (HTTPS only) |
| `DEMO_PASSWORD` | no | Password `db:seed` gives the demo accounts. If unset, they can't sign in. |
| `TEST_DATABASE_URL` | no | Disposable database for the API integration tests |
| `SESSION_TTL_DAYS` | no (30) | How long a sign-in lasts |
| `PORT` | no (3000) | Express port. Render sets it automatically. |

Commit `.env.example` only. Never commit `.env` or a real `DATABASE_URL`.

## Database

The schema is in [`prisma/schema.prisma`](prisma/schema.prisma): `Club`, `Book`, `Checkpoint`,
`Member` (an account), `Session`, `Membership`, `ClubBlock`, `Progress`, `Thread`, `Post` (a
reply).

- A Club has an owner (`ownerId`), a unique `inviteCode`, and many Books. The **current book** is
  the one started most recently (`startedAt`).
- A Book has many Checkpoints, with `@@unique([bookId, index])`.
- Member to Club goes through `Membership`. `ClubBlock` lists removed members who can't rejoin.
- Member to Book goes through `Progress`: the member's checkpoint in that book, kept when they
  leave.
- A Thread belongs to a Book and a Checkpoint. A Post belongs to a Thread and a Checkpoint.
- Deleted accounts are anonymised (`deletedAt`, name "Former member", placeholder email, no
  password), so their posts keep conversations intact.

| Script | What it does |
| --- | --- |
| `npm run db:migrate` | `prisma migrate dev`: apply and create migrations in development |
| `npm run db:deploy` | `prisma migrate deploy`: apply committed migrations (production) |
| `npm run db:seed` | Idempotent seed. Re-running restores the demo records, including the demo members' progress. Accounts and posts created in the app are kept. |
| `npm run db:verify` | Connectivity, migrations, seed, and a no-leak check of every member's discussion |

The migrations upgrade existing databases in place:

- `accounts_and_sessions` gives existing members a placeholder `@members.invalid` email and no
  password.
- `multi_club` turns each club's active book into its first book, makes the earliest member the
  owner, generates an invite code, and moves threads onto their book.

## API

All endpoints are under `/api` and use JSON; writes must send `application/json`, including
`DELETE` (send `{}`). Everything except health and sign-in/sign-up needs a session.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health`, `/health/db` | Server is running / Prisma can reach PostgreSQL |
| POST | `/auth/signup`, `/auth/login`, `/auth/logout` | Accounts and sessions |
| GET | `/auth/me` | The signed-in account (`401` if none) |
| GET | `/account` | Account, reading history, clubs you own |
| PATCH | `/account` | `{ name }` |
| PUT | `/account/email` | `{ email, password }` |
| DELETE | `/account` | `{ password }`: anonymise the account (`409` if you own clubs with members) |
| GET | `/clubs` | Homepage cards for your clubs |
| POST | `/clubs` | `{ name, book: { title, author, checkpoints[] } }`: create a club |
| GET | `/clubs/:clubId` | Club detail: books (newest first), members, invite code, blocks (owner) |
| PATCH / DELETE | `/clubs/:clubId` | Rename / delete (owner) |
| POST | `/clubs/:clubId/invite/reset` | New invite code (owner) |
| POST | `/clubs/:clubId/books` | `{ title, author, checkpoints[] }`: start the next book (owner) |
| POST | `/clubs/:clubId/leave` | Leave (`409` for an owner with other members) |
| POST | `/clubs/:clubId/owner` | `{ memberId }`: hand over ownership (owner) |
| DELETE | `/clubs/:clubId/members/:memberId` | Remove and block a member (owner) |
| DELETE | `/clubs/:clubId/blocks/:memberId` | Lift a block (owner) |
| GET | `/invites/:code` | Preview: club, current book, member count, already a member, blocked |
| POST | `/invites/:code/join` | Join (`403` if blocked); idempotent |
| GET | `/clubs/:clubId/books/:bookId` | Book, checkpoints, members' progress in it, and `me` |
| GET | `/clubs/:clubId/books/:bookId/discussion` | Discussion filtered for your checkpoint |
| PUT | `/clubs/:clubId/books/:bookId/progress` | `{ checkpointIndex }`: returns `{ me, discussion }` |
| POST | `/clubs/:clubId/books/:bookId/threads` | `{ title, body }`, stamped with your checkpoint |
| POST | `…/threads/:threadId/replies` | `{ body }`, stamped with your checkpoint |

## Project structure

```
package.json        npm workspaces + shared dev/build/start/db scripts
prisma.config.ts    Prisma 7 config (schema, migrations, seed command)
prisma/             schema.prisma, migrations/, seed.ts, verify.ts
shared/             types, demo fixtures, visibility rule, checkpoint suggestions, validation
backend/            Express API (TypeScript); serves frontend/dist in production
  src/auth/         password hashing, sessions, cookie handling
  src/services/     accounts, clubs (cards, invites, owner tools), books (discussion, posting)
  src/routes/       HTTP layer
  src/db/           Prisma client and the reusable seed
  test/             unit tests + integration/ (needs TEST_DATABASE_URL)
frontend/           Vue 3 + Vite + Pinia client
  src/data/api.ts   every API call (the client never filters discussion itself)
  src/stores/       auth store, club page store
  src/views/        sign in/up, homepage, new club, join, club page, club settings,
                    next book, account
render.yaml         Render blueprint (web service + PostgreSQL), untested
```

The Prisma client is generated into `backend/src/generated/` on `npm install` (gitignored). The
backend is type-checked with `tsc` and bundled with esbuild into `backend/dist/server.js`.

| Script (repo root) | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch, :3000) + Vite (:5173) |
| `npm run build` | Type-check and build the Vue app, then type-check and bundle the server |
| `npm start` | `node backend/dist/server.js`: serves `/api` and `frontend/dist` |
| `npm test` | All tests (integration tests only with `TEST_DATABASE_URL`) |

## Hosting on Render (not yet tested)

[`render.yaml`](render.yaml) describes one Node web service plus one managed PostgreSQL
database.

1. Push the repository to GitHub, then create the Blueprint (or the two services by hand).
2. Environment variables: `DATABASE_URL` (from the database) and `NODE_ENV=production`.
3. Build command: `npm ci --include=dev && npm run build`. `--include=dev` is needed because
   `NODE_ENV=production` would otherwise skip the build tools.
4. Pre-deploy command: `npx prisma migrate deploy`. This needs a paid instance; on the free one,
   append it to the build command.
5. Start command: `npm start`.
6. Optional, for a demo deployment: seed once from the service's Shell tab with
   `npm run db:seed`. The seed creates the demo clubs with **fixed, published invite codes**
   (`SALTORCH01`, `HARBOUR001`), so don't seed a real deployment. Set `DEMO_PASSWORD` only if you
   want the demo accounts to be able to sign in.
7. Check `https://<your-service>.onrender.com/api/health/db`.

## Not done yet

Deferred on purpose; the code is structured so each can be added without reworking the core:

- **Security hardening:** login and sign-up rate limiting, account lockout, password reset and
  email verification, security headers (CSP/HSTS), audit logging, and a session list or "sign
  out everywhere".
- **Changing your password** (and password reset). Email changes need the current password
  because there's no email verification yet.
- **Moderation:** editing or deleting posts, and reporting.
- **Editing a book's checkpoints** after it's saved. Posts are stamped with checkpoints, so this
  needs a migration story.
- **Public club directory or join requests.** Joining is by invite only.
- **Scale:** discussion is filtered in memory from all of a club's threads, which is fine for
  book-club sizes. Pagination and query-level filtering come later, still via `isVisibleAt`.
- Notifications, catch-up summaries, search, and reading forecasts.
- A live-tested Render deployment.

All demo books and authors are fictional, so the demo discussion can include real spoilers.
