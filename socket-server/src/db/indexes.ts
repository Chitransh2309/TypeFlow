import { getRoomsCollection } from "./rooms";
import { getResultsCollection } from "./results";

/** Idempotent: createIndexes is a no-op for indexes that already exist with the same spec. */
export async function ensureIndexes(): Promise<void> {
  const rooms = await getRoomsCollection();
  await rooms.createIndexes([
    { key: { roomId: 1 }, unique: true, name: "roomId_unique" },
    // Only ever set while status === "waiting" and $unset once a contest starts,
    // so this can never delete a room mid-contest or orphan its results.
    { key: { waitingExpiresAt: 1 }, expireAfterSeconds: 0, name: "waitingExpires_ttl" },
    { key: { status: 1, isPublic: 1, createdAt: -1 }, name: "browse_listing" },
  ]);

  const results = await getResultsCollection();
  await results.createIndexes([
    { key: { roomId: 1, userId: 1 }, unique: true, name: "roomId_userId_unique" },
  ]);

  console.log("[socket-server] MongoDB indexes ensured");
}
