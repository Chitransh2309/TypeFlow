import type { Collection, WithId } from "mongodb";
import { getDb } from "./mongo";
import type { Room, RoomParticipant } from "../../../lib/models/room";
import { verifyPassword } from "../../../lib/password";

export async function getRoomsCollection(): Promise<Collection<Room>> {
  const db = await getDb();
  return db.collection<Room>("rooms");
}

export async function getRoomById(roomId: string): Promise<WithId<Room> | null> {
  const collection = await getRoomsCollection();
  return collection.findOne({ roomId });
}

export async function touchActivity(roomId: string): Promise<void> {
  const collection = await getRoomsCollection();
  await collection.updateOne({ roomId }, { $set: { lastActivityAt: new Date() } });
}

// Mirrors lib/rooms.ts's WAITING_ROOM_TTL_MS (which only sets this once, at
// creation) - joinRoom below refreshes it on every new join so a room that's
// genuinely filling up doesn't get TTL-deleted out from under it mid-fill.
const WAITING_ROOM_TTL_MS = 30 * 60 * 1000;

export type JoinRoomResult =
  | { ok: true; room: WithId<Room>; alreadyJoined: boolean }
  | { ok: false; error: "not_found" | "not_waiting" | "full" | "password_required" | "invalid_password" };

export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
  userImage: string | undefined,
  password?: string
): Promise<JoinRoomResult> {
  const collection = await getRoomsCollection();
  const room = await collection.findOne({ roomId });
  if (!room) return { ok: false, error: "not_found" };

  // Already a participant: treat as re-attaching a live socket, not a new join.
  const existing = room.participants.some((p) => p.userId === userId);
  if (existing) {
    return { ok: true, room, alreadyJoined: true };
  }

  if (room.status !== "waiting") return { ok: false, error: "not_waiting" };

  if (!room.isPublic && room.passwordHash) {
    if (!password) return { ok: false, error: "password_required" };
    const valid = await verifyPassword(password, room.passwordHash);
    if (!valid) return { ok: false, error: "invalid_password" };
  }

  const participant: RoomParticipant = {
    userId,
    userName,
    userImage,
    joinedAt: new Date(),
    connectionStatus: "connected",
    connectedAt: new Date(),
  };

  const updated = await collection.findOneAndUpdate(
    {
      roomId,
      status: "waiting",
      "participants.userId": { $ne: userId },
      $expr: { $lt: [{ $size: "$participants" }, "$maxParticipants"] },
    },
    {
      $push: { participants: participant },
      $set: {
        lastActivityAt: new Date(),
        waitingExpiresAt: new Date(Date.now() + WAITING_ROOM_TTL_MS),
      },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    // Lost the atomic race (or state changed between the reads above and now)
    // - re-read to give an accurate error rather than a generic failure.
    const recheck = await collection.findOne({ roomId });
    if (!recheck) return { ok: false, error: "not_found" };
    if (recheck.status !== "waiting") return { ok: false, error: "not_waiting" };
    if (recheck.participants.some((p) => p.userId === userId)) {
      return { ok: true, room: recheck, alreadyJoined: true };
    }
    return { ok: false, error: "full" };
  }

  return { ok: true, room: updated, alreadyJoined: false };
}

const MIN_PARTICIPANTS_TO_START = 2;

export type StartContestResult =
  | { ok: true; room: WithId<Room> }
  | { ok: false; error: "not_found" | "not_host" | "not_waiting" | "not_enough_participants" };

export async function startContest(
  roomId: string,
  userId: string,
  testText: string
): Promise<StartContestResult> {
  const collection = await getRoomsCollection();

  // The client disables "Start Contest" below MIN_PARTICIPANTS_TO_START, but
  // that's UI-only - enforce it here too (atomically, alongside the
  // status/host check) so a stale client or a participant leaving right as
  // the host clicks can't start a contest nobody else is actually in.
  const updated = await collection.findOneAndUpdate(
    {
      roomId,
      status: "waiting",
      "host.userId": userId,
      $expr: { $gte: [{ $size: "$participants" }, MIN_PARTICIPANTS_TO_START] },
    },
    {
      $set: {
        status: "active",
        startedAt: new Date(),
        testText,
        lastActivityAt: new Date(),
      },
      $unset: { waitingExpiresAt: "" },
    },
    { returnDocument: "after" }
  );

  if (updated) return { ok: true, room: updated };

  const room = await collection.findOne({ roomId });
  if (!room) return { ok: false, error: "not_found" };
  if (room.host.userId !== userId) return { ok: false, error: "not_host" };
  if (room.status !== "waiting") return { ok: false, error: "not_waiting" };
  return { ok: false, error: "not_enough_participants" };
}

export async function setParticipantConnectionStatus(
  roomId: string,
  userId: string,
  status: "connected" | "disconnected"
): Promise<void> {
  const collection = await getRoomsCollection();
  const field = status === "connected" ? "connectedAt" : "disconnectedAt";
  await collection.updateOne(
    { roomId, "participants.userId": userId },
    {
      $set: {
        "participants.$.connectionStatus": status,
        [`participants.$.${field}`]: new Date(),
        lastActivityAt: new Date(),
      },
    }
  );
}

/** Waiting-room real leave: removes the participant, deletes the room if now empty. */
export async function leaveWaitingRoom(
  roomId: string,
  userId: string
): Promise<{ deleted: boolean; room: WithId<Room> | null }> {
  const collection = await getRoomsCollection();
  const updated = await collection.findOneAndUpdate(
    { roomId },
    { $pull: { participants: { userId } }, $set: { lastActivityAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!updated) return { deleted: false, room: null };

  if (updated.participants.length === 0) {
    await collection.deleteOne({ roomId });
    return { deleted: true, room: updated };
  }

  return { deleted: false, room: updated };
}

export async function deleteRoom(roomId: string): Promise<void> {
  const collection = await getRoomsCollection();
  await collection.deleteOne({ roomId });
}

export async function migrateHost(
  roomId: string,
  newHost: { userId: string; userName: string; userImage?: string }
): Promise<void> {
  const collection = await getRoomsCollection();
  await collection.updateOne(
    { roomId },
    { $set: { host: newHost, lastActivityAt: new Date() } }
  );
}

/** Normal contest end (host action or server time-limit expiry) - not abandoned.
 * Conditioned on status:"active" and reports whether it actually flipped the
 * status, so a caller racing another finisher (e.g. two participants'
 * result:submit both seeing "everyone's done" at once) can tell it lost and
 * skip re-finalizing/re-emitting instead of just overwriting blindly. */
export async function endContest(roomId: string): Promise<boolean> {
  const collection = await getRoomsCollection();
  const result = await collection.updateOne(
    { roomId, status: "active" },
    { $set: { status: "finished", endedAt: new Date(), lastActivityAt: new Date() } }
  );
  return result.modifiedCount > 0;
}

/** Force-finish an active room nobody is connected to anymore, instead of deleting it.
 * Same race-reporting shape as endContest, for the same reason (concurrent
 * disconnects can each independently observe "nobody's left"). */
export async function abandonActiveRoom(roomId: string): Promise<boolean> {
  const collection = await getRoomsCollection();
  const result = await collection.updateOne(
    { roomId, status: "active" },
    {
      $set: {
        status: "finished",
        endedAt: new Date(),
        abandoned: true,
        lastActivityAt: new Date(),
      },
    }
  );
  return result.modifiedCount > 0;
}

/** Rooms stuck in "active" past a sane ceiling (e.g. crashed before the time-limit
 * timer fired) or "waiting" long enough to be considered stale - used by the sweep. */
export async function findStaleActiveRooms(olderThanMs: number): Promise<WithId<Room>[]> {
  const collection = await getRoomsCollection();
  const cutoff = new Date(Date.now() - olderThanMs);
  return collection.find({ status: "active", lastActivityAt: { $lt: cutoff } }).toArray();
}

/** Waiting rooms past their TTL - the Mongo TTL index on waitingExpiresAt is
 * the hard backstop that guarantees these eventually get cleaned up even if
 * this process is down (they're still publicly browsable via the Next.js app
 * independent of this process), but reading them here first lets the sweep
 * notify anyone still connected before deleting, instead of Mongo silently
 * vanishing the room out from under them. */
export async function findExpiredWaitingRooms(): Promise<WithId<Room>[]> {
  const collection = await getRoomsCollection();
  return collection.find({ status: "waiting", waitingExpiresAt: { $lte: new Date() } }).toArray();
}
