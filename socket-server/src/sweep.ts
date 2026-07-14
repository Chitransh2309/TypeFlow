import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../../lib/socket-events";
import * as roomsDb from "./db/rooms";
import * as resultsDb from "./db/results";
import * as state from "./rooms/room-state";
import type { SocketData } from "./index";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_ACTIVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes with no activity

// This catches two kinds of orphaned rooms once every SWEEP_INTERVAL_MS:
//
// - "active" rooms stuck open with no recent activity - typically because
//   the process restarted mid-contest and lost its in-memory timers/progress,
//   or every participant's socket vanished without a clean disconnect.
// - "waiting" rooms past their TTL. Mongo's own TTL index on waitingExpiresAt
//   is the hard backstop that deletes these regardless of whether this
//   process is even running (they're browsable via the Next.js app
//   independent of this process) - this just gets there first while the
//   process is warm, so anyone still sitting in the lobby is notified instead
//   of the room silently vanishing on them.
//
// Note this only runs while the process is warm; a spun-down Render free-tier
// instance has no active users to be stuck, so that's fine either way.
export function startSweep(io: AppServer): void {
  setInterval(() => {
    sweepStaleActiveRooms(io).catch((err) =>
      console.error("[socket-server] sweep (active) error:", err)
    );
    sweepExpiredWaitingRooms(io).catch((err) =>
      console.error("[socket-server] sweep (waiting) error:", err)
    );
  }, SWEEP_INTERVAL_MS);
}

async function sweepStaleActiveRooms(io: AppServer): Promise<void> {
  const staleRooms = await roomsDb.findStaleActiveRooms(STALE_ACTIVE_THRESHOLD_MS);
  for (const room of staleRooms) {
    await resultsDb.dnfFillMissing(room.roomId, room.participants, "dnf-timeout");
    // Conditioned on status:"active" - guards against racing a finish/abandon
    // that a live connection triggers concurrently with this sweep tick.
    const abandoned = await roomsDb.abandonActiveRoom(room.roomId);
    if (abandoned) {
      await resultsDb.finalizePositions(room.roomId);
      io.to(`room:${room.roomId}`).emit("contest:finished", {
        finishedAt: new Date().toISOString(),
        reason: "abandoned",
      });
      console.log(`[socket-server] sweep: force-finished stale active room ${room.roomId}`);
    }
    state.cleanupRoom(room.roomId);
  }
}

async function sweepExpiredWaitingRooms(io: AppServer): Promise<void> {
  const expired = await roomsDb.findExpiredWaitingRooms();
  for (const room of expired) {
    io.to(`room:${room.roomId}`).emit("room:deleted", { reason: "waiting-expired" });
    await roomsDb.deleteRoom(room.roomId);
    state.cleanupRoom(room.roomId);
    console.log(`[socket-server] sweep: deleted expired waiting room ${room.roomId}`);
  }
}
