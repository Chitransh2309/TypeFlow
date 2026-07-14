# TypeFlow socket-server

Standalone, always-on Socket.io server for TypeFlow's Rooms feature. Deployed separately
from the Next.js app so real-time connections aren't subject to serverless function
duration limits or cross-instance broadcast gaps.

It owns all live room state (participants, progress, contest timers, grace-period
disconnect handling) and is the sole writer for join/leave/start/progress/result/end
operations in MongoDB. The Next.js app keeps only the non-live REST operations (create,
browse, search, read results, delete a never-started room).

## Why this imports from `../lib`

This service imports several files directly from the Next app's `lib/` directory via
relative paths (`../lib/models/room`, `../lib/socket-events`, `../lib/room-id`,
`../lib/password`, `../lib/anti-cheat`, `../lib/words-data`) rather than duplicating them.
These files are framework-agnostic (no Next.js/browser-only APIs) and are the single
source of truth for the room domain types and the client/server event contract - both
services must always agree on these, so importing beats copy-pasting.

Two of those files (`../lib/room-id.ts`, `../lib/password.ts`) depend on `nanoid` and
`bcryptjs`, which are dependencies of the **root** `package.json`, not this one. This
only matters for the production build (see below) - local dev already has the root
`node_modules` installed.

## Local development

From the repo root, `npm install` once (if you haven't already, for the Next app).
Then:

```bash
cd socket-server
npm install
cp .env.example .env   # fill in MONGODB_URI / NEXTAUTH_SECRET (same values as the Next app's .env)
npm run dev
```

`GET http://localhost:4000/health` should respond `{ "status": "ok", ... }`.

## Deploying to Render

Use Render's **native Node runtime, not Docker**. A Docker build scoped to this
directory would only see `socket-server/` in its build context and couldn't resolve the
`../lib/*` imports above - the native runtime checks out the whole repo and just changes
into the Root Directory to run commands, so the sibling `lib/` folder is present on disk.

Render service settings:
- **Root Directory**: `socket-server`
- **Build Command**: `npm install --prefix .. --legacy-peer-deps && npm install --legacy-peer-deps && npm run build`
  (the `--prefix ..` step installs the root `package.json`'s dependencies - specifically
  `nanoid` and `bcryptjs`, needed because `../lib/room-id.ts` and `../lib/password.ts`
  live outside this directory and esbuild needs to resolve+inline them at build time.
  `--legacy-peer-deps` is required there: the root project intentionally runs a few
  slightly mismatched peer versions - e.g. `@auth/core@0.37.4` wants
  `@simplewebauthn/browser@^9` but the root pins `^10` - which pnpm (used locally/on
  Vercel) just warns about, but plain npm treats as a hard ERESOLVE failure)
- **Start Command**: `npm start`
- **Health Check Path**: `/health`
- **Environment**: copy `.env.example`'s keys into Render's environment variables,
  using the *same* `NEXTAUTH_SECRET`/`MONGODB_URI` values as the Next.js app's deployment,
  and set `ALLOWED_ORIGIN` to the Next.js app's real deployed origin.

On the free tier, this service spins down after 15 minutes of inactivity and takes
roughly a minute to cold-start on the next connection. The client (`hooks/use-socket-room.ts`)
has an explicit "waking up the game server" UI state for this - it's expected behavior,
not a bug.
