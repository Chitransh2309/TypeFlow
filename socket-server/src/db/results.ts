import type { Collection, WithId } from "mongodb";
import { getDb } from "./mongo";
import type { RoomParticipant, RoomResult } from "../../../lib/models/room";

export async function getResultsCollection(): Promise<Collection<RoomResult>> {
  const db = await getDb();
  return db.collection<RoomResult>("room_results");
}

export type UpsertResultInput = Omit<RoomResult, "createdAt" | "position"> & {
  position?: number;
};

/** Idempotent upsert keyed on {roomId, userId} - safe against duplicate tabs/resubmits. */
export async function upsertResult(input: UpsertResultInput): Promise<void> {
  const collection = await getResultsCollection();
  await collection.updateOne(
    { roomId: input.roomId, userId: input.userId },
    {
      $setOnInsert: {
        roomId: input.roomId,
        userId: input.userId,
        createdAt: new Date(),
      },
      $set: {
        userName: input.userName,
        userImage: input.userImage,
        wpm: input.wpm,
        accuracy: input.accuracy,
        elapsedTime: input.elapsedTime,
        charsTyped: input.charsTyped,
        correctChars: input.correctChars,
        dnf: input.dnf,
        finishReason: input.finishReason,
        flagged: input.flagged,
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    },
    { upsert: true }
  );
}

/**
 * Insert-only variant used by DNF-fill paths (time-expiry / all-finished /
 * disconnect). Unlike upsertResult, this never overwrites an existing
 * document - if the doc already exists (e.g. the user's real result:submit
 * landed a moment before this ran), it's a no-op. Without this, a
 * check-then-act race (hasResult check, then a later unconditional upsert)
 * could let a stale DNF write clobber a genuine just-submitted result.
 */
export async function upsertResultIfAbsent(input: UpsertResultInput): Promise<void> {
  const collection = await getResultsCollection();
  await collection.updateOne(
    { roomId: input.roomId, userId: input.userId },
    {
      $setOnInsert: {
        roomId: input.roomId,
        userId: input.userId,
        userName: input.userName,
        userImage: input.userImage,
        wpm: input.wpm,
        accuracy: input.accuracy,
        elapsedTime: input.elapsedTime,
        charsTyped: input.charsTyped,
        correctChars: input.correctChars,
        dnf: input.dnf,
        finishReason: input.finishReason,
        flagged: input.flagged,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function getRoomResults(roomId: string): Promise<WithId<RoomResult>[]> {
  const collection = await getResultsCollection();
  return collection.find({ roomId }).sort({ position: 1 }).toArray();
}

export async function hasResult(roomId: string, userId: string): Promise<boolean> {
  const collection = await getResultsCollection();
  const doc = await collection.findOne({ roomId, userId }, { projection: { _id: 1 } });
  return doc !== null;
}

export async function countResults(roomId: string): Promise<number> {
  const collection = await getResultsCollection();
  return collection.countDocuments({ roomId });
}

/**
 * Fills in a bare DNF row (no live-progress data available, so wpm/accuracy/
 * charsTyped are all zero) for any participant without a result yet. Used by
 * paths with no in-memory progress to fall back on and nobody left connected
 * to notify - namely the stale-room sweep, which by definition catches rooms
 * orphaned by a process restart (in-memory progress lost) or a silent mass
 * disconnect. Without this, those participants would simply be missing from
 * the leaderboard entirely instead of showing as DNF.
 */
export async function dnfFillMissing(
  roomId: string,
  participants: RoomParticipant[],
  finishReason: "dnf-timeout" | "dnf-disconnect"
): Promise<void> {
  for (const participant of participants) {
    await upsertResultIfAbsent({
      roomId,
      userId: participant.userId,
      userName: participant.userName,
      userImage: participant.userImage,
      wpm: 0,
      accuracy: 0,
      elapsedTime: 0,
      charsTyped: 0,
      correctChars: 0,
      dnf: true,
      finishReason,
      flagged: false,
    });
  }
}

export async function getResult(roomId: string, userId: string): Promise<WithId<RoomResult> | null> {
  const collection = await getResultsCollection();
  return collection.findOne({ roomId, userId });
}

/**
 * One authoritative ranking pass, run once when a contest transitions to
 * "finished" - not computed incrementally per submission, which would be
 * exactly the kind of check-then-act race we're avoiding elsewhere.
 * Finishers rank by wpm desc, accuracy desc; DNFs rank after, by chars typed desc.
 */
export async function finalizePositions(roomId: string): Promise<void> {
  const collection = await getResultsCollection();
  const results = await collection.find({ roomId }).toArray();

  const finishers = results
    .filter((r) => !r.dnf)
    .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy);
  const dnfs = results
    .filter((r) => r.dnf)
    .sort((a, b) => (b.charsTyped ?? 0) - (a.charsTyped ?? 0));

  const ranked = [...finishers, ...dnfs];
  if (ranked.length === 0) return;

  await collection.bulkWrite(
    ranked.map((r, i) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { position: i + 1 } },
      },
    }))
  );
}
