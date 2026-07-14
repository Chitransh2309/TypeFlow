# Typing Contest Rooms Feature

## Overview

The TypeFlow Rooms feature lets users create and join multiplayer typing contest rooms
and compete with others in real-time. The room owner starts the contest, everyone gets
the same server-generated text, and live WPM/accuracy/progress are broadcast to
everyone via Socket.io.

- **Public & Private Rooms**: create public rooms visible to all, or private
  password-protected rooms
- **Customizable Settings**: difficulty, test mode (time/words), duration/word count,
  max participants
- **Real-time Progress Tracking**: live WPM, accuracy, and progress bars for every
  participant
- **Live Leaderboard**: server-computed rankings after each contest, including DNFs
- **Reconnect handling**: brief disconnects (tab refresh, network blip) don't remove you
  from an in-progress contest; if the host disconnects, the host role migrates to
  another connected participant instead of destroying the room

## Architecture

This feature is split across **two separately deployed services**:

1. **The Next.js app** (this repo's normal deployment) - pages, auth, and the REST
   operations that don't need a live connection: create/browse/search a room, read
   results, delete a never-started room.
2. **`socket-server/`** - a standalone, always-on Node + Express + Socket.io service
   (see `socket-server/README.md`), deployed separately (e.g. Render). It owns every
   live-lifecycle action - join, leave, progress, contest start/end, result
   submission - and is the sole writer for those in MongoDB.

This split exists because Socket.io needs a persistent server process to hold live
connections and in-memory room state; Next.js API routes (App Router) don't expose the
underlying HTTP server the old Pages Router hack relied on, and typical serverless
hosting doesn't keep a process alive between requests.

### Auth handshake across the two services

The Next.js app's session cookie is scoped to its own origin, so the socket-server
(a different origin) can't see it directly. Instead:

1. The client calls `POST /api/socket-token` (`app/api/socket-token/route.ts`) on the
   Next.js app, which verifies the NextAuth session and mints a 60-second signed JWT
   using the same `NEXTAUTH_SECRET` (or `AUTH_SECRET`) the app already uses for
   sessions - no separate secret to provision.
2. The client passes that token via Socket.io's `auth` option when connecting to the
   socket-server, which re-mints a fresh token on every reconnection attempt.
3. `socket-server/src/auth/socket-auth-middleware.ts` verifies the token and attaches
   the identity to `socket.data.user`. Every event handler derives `userId` from that
   verified identity - never from a client-supplied field in the event payload.

### Database Schema

#### `rooms` collection
```typescript
{
  roomId: string,              // unique room code, e.g. "ABC123"
  name: string,
  host: { userId, userName, userImage? },
  isPublic: boolean,
  passwordHash?: string | null,
  settings: { mode: "time" | "words", timeLimit?, wordCount?, difficulty },
  status: "waiting" | "active" | "finished",
  participants: [{
    userId, userName, userImage?, joinedAt,
    connectionStatus: "connected" | "disconnected",
    connectedAt?, disconnectedAt?,
  }],
  maxParticipants: number,
  createdAt: Date,
  startedAt?: Date,
  endedAt?: Date,
  testText?: string,           // generated server-side by the socket-server, never client-supplied
  lastActivityAt: Date,
  waitingExpiresAt?: Date,      // TTL anchor - only set while status === "waiting"
  abandoned?: boolean,          // true if force-finished because everyone disconnected
}
```
Indexes: unique on `roomId`; TTL on `waitingExpiresAt` (auto-deletes rooms that never
started within 30 minutes); `{status, isPublic, createdAt}` for the browse listing.

#### `room_results` collection
```typescript
{
  roomId, userId, userName, userImage?,
  wpm, accuracy, elapsedTime,
  charsTyped, correctChars,     // raw counts the server scores from
  dnf: boolean,
  finishReason: "completed" | "dnf-disconnect" | "dnf-timeout" | "dnf-host-ended",
  flagged: boolean,             // exceeded the plausibility ceiling - shown, not hidden
  position: number,             // computed once, authoritatively, when the contest ends
  createdAt: Date,
}
```
Unique index on `{roomId, userId}` - result submission is an idempotent upsert.

### API Routes (Next.js app - non-live operations only)

- `GET /api/rooms` - list public waiting rooms
- `POST /api/rooms` - create a new room
- `GET /api/rooms/:roomId` - room snapshot (also used as a preview before joining)
- `GET /api/rooms/search?code=` - look up a room by code
- `GET /api/rooms/:roomId/results` - leaderboard (read-only)
- `DELETE /api/rooms/:roomId/delete` - host deletes a never-started room
- `POST /api/socket-token` - mint the short-lived socket-server auth token

### Socket.io Events (socket-server - all live operations)

| Event | Direction | Notes |
|---|---|---|
| `room:join` | C→S (ack) | `{roomId, password?}` - userId from the verified token |
| `room:leave` | C→S | |
| `progress:send` | C→S | debounced client-side (~200ms), rate-limited server-side |
| `contest:start` | C→S (ack) | host-only; server generates the test text |
| `result:submit` | C→S (ack) | `{roomId, charsTyped, correctChars}` - server computes wpm/accuracy/elapsed itself |
| `contest:end` | C→S (ack) | host-only |
| `room:updated` | S→C | participants/status changed |
| `participant:connection-changed` | S→C | drives a "reconnecting…" indicator, not an immediate removal |
| `room:host-changed` | S→C | host migrated to another participant |
| `user:joined` / `user:left` | S→C | |
| `contest:started` | S→C | `{testText, startedAt}` |
| `progress:update` | S→C | live WPM/accuracy/progress |
| `user:finished` | S→C | includes `dnf`/`flagged` |
| `contest:finished` | S→C | `{finishedAt, reason}` - host-ended, time-expired, or abandoned |
| `room:deleted` | S→C | `{reason}` - host-left-empty or waiting-expired |

## Anti-cheat (pragmatic, not a full replay system)

`lib/anti-cheat.ts`'s `scoreResult` runs server-side on every `result:submit`:
- Elapsed time is the server's own clock (time since it broadcast `contest:started`),
  never a client-reported value.
- Rejects results claiming an elapsed time under 1 second (physically impossible).
- Cross-checks against the last `progress:send` seen for that user.
- WPM above 300 (well past the ~216 WPM world record) is still saved, but marked
  `flagged` - shown on the leaderboard with a badge rather than hidden.

## Reconnect & failure handling

- A disconnect starts a grace period (~20s for a regular participant, ~50s for the
  host) before anything changes - a page refresh or brief network drop recovers
  silently, since all live state (progress, room membership) lives server-side.
- If the grace period expires: in a still-`"waiting"` room, the participant is
  removed (and the room deleted if now empty); in an `"active"` contest, they're never
  removed from the participant list - instead they're marked DNF from their last known
  progress, and everyone else continues unaffected.
- If the departing user was the host and someone else is still connected, host role
  migrates to the longest-connected remaining participant instead of ending the room.
- Time-mode contests have a server-owned timer - when the limit expires, anyone who
  hasn't submitted is auto-DNF'd and the contest finishes automatically (this didn't
  exist before; time-mode contests previously had no way to auto-complete).
- A background sweep force-finishes any `"active"` room that's gone stale (e.g. the
  process restarted mid-contest) rather than leaving it open forever.

## Cold-start UX (Render free tier)

The socket-server's free-tier instance spins down after ~15 minutes idle and takes up
to a minute to wake on the next connection. `hooks/use-socket-room.ts` exposes a
`connectionPhase` (`connecting` → `waking` after 5s → `failed` after 75s, with a manual
retry) so the room page shows an honest "waking up the game server" state instead of a
silent hang. `app/rooms/page.tsx` also fires a fire-and-forget health-check ping as soon
as the room browser loads, so the instance is often already warm by the time a user
creates or joins a room.

## Components

### Pages
- `/rooms` - room browser and creation
- `/rooms/[roomId]` - lobby, live contest, or leaderboard, depending on room status

### Components (`components/rooms/`)
- `CreateRoomDialog`, `RoomBrowser`, `JoinRoomDialog` - browse/create/join by code
  (joining now navigates to the room page and lets its socket connection perform the
  actual join, rather than a separate REST call before navigating)
- `RoomLobby`, `RoomContest`, `RoomLeaderboard`, `UserProgressCard` - driven entirely
  by props from `app/rooms/[roomId]/page.tsx`, which owns the single socket connection
  for the page (previously `RoomContest` opened its own second socket connection
  independently of the page - consolidated to one connection per page)

## Setup

### Environment variables

Next.js app (`.env`): existing `MONGODB_URI`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, plus `NEXT_PUBLIC_SOCKET_SERVER_URL` (the
socket-server's URL, e.g. `http://localhost:4000` locally).

`socket-server/.env`: see `socket-server/.env.example` - same `MONGODB_URI` and
`NEXTAUTH_SECRET` values as the Next app, plus `ALLOWED_ORIGIN` (the Next app's origin,
for CORS).

### Running locally

```bash
npm install && npm run dev            # Next.js app, http://localhost:3000
cd socket-server && npm install && npm run dev   # socket-server, http://localhost:4000
```

### Deploying

The Next.js app deploys however it already does. The socket-server deploys separately
(see `socket-server/README.md` for the Render-specific settings, including why it must
use Render's native Node runtime rather than Docker).

## Future Enhancements

- [ ] Matchmaking for similar skill levels
- [ ] Chat during contest
- [ ] Replay/recording of contests
- [ ] Friends-only rooms
- [ ] Seasonal leaderboards / badges
- [ ] Custom word lists
- [ ] Redis-backed Socket.io adapter if the socket-server ever needs more than one
      instance (not needed yet - a single instance is plenty for expected load)
