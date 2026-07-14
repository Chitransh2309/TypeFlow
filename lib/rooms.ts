import clientPromise from "@/lib/mongodb";
import { Room, RoomResult } from "@/lib/models/room";
import { ObjectId, type Collection, type WithId } from "mongodb";
import { generateRoomId } from "@/lib/room-id";
import { hashPassword } from "@/lib/password";

// Non-live operations only - room creation, browsing, search, reading results,
// and deleting a never-started room. Join/leave/start/progress/result/end are
// owned by the standalone socket-server (see socket-server/src/db/rooms.ts),
// which is the sole writer for those live-lifecycle actions.

const DB_NAME = "typeflow";
const ROOMS_COLLECTION = "rooms";
const ROOM_RESULTS_COLLECTION = "room_results";

export async function getRoomsCollection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection<Room>(ROOMS_COLLECTION);
}

export async function getRoomResultsCollection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection<RoomResult>(ROOM_RESULTS_COLLECTION);
}

// createRoom's retry-on-collision loop depends on this unique index existing.
// The socket-server also creates it (and several others) at its own startup,
// but room creation can happen before that service has ever booted, so this
// Next app ensures the one index it actually depends on for itself too.
let roomIdIndexEnsured = false;
async function ensureRoomIdIndex(collection: Collection<Room>) {
  if (roomIdIndexEnsured) return;
  await collection.createIndexes([{ key: { roomId: 1 }, unique: true, name: "roomId_unique" }]);
  roomIdIndexEnsured = true;
}

const WAITING_ROOM_TTL_MS = 30 * 60 * 1000;

// Create a new room
export async function createRoom(
  roomData: Omit<
    Room,
    "roomId" | "status" | "createdAt" | "participants" | "lastActivityAt" | "waitingExpiresAt"
  >
): Promise<Room> {
  const collection = await getRoomsCollection();
  await ensureRoomIdIndex(collection);

  const passwordHash = roomData.passwordHash ? await hashPassword(roomData.passwordHash) : null;
  const now = new Date();

  const baseRoom: Omit<Room, "roomId"> = {
    ...roomData,
    passwordHash,
    status: "waiting",
    participants: [
      {
        userId: roomData.host.userId,
        userName: roomData.host.userName,
        userImage: roomData.host.userImage,
        joinedAt: now,
        connectionStatus: "connected",
        connectedAt: now,
      },
    ],
    createdAt: now,
    lastActivityAt: now,
    waitingExpiresAt: new Date(now.getTime() + WAITING_ROOM_TTL_MS),
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const room: Room = { ...baseRoom, roomId: generateRoomId() };
    try {
      await collection.insertOne(room);
      return room;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) continue; // roomId collision, retry
      throw err;
    }
  }

  throw new Error("Could not allocate a unique room code, please try again");
}

// Get public rooms (legacy - kept for backwards compatibility)
export async function getPublicRooms(
  limit: number = 20,
  skip: number = 0
): Promise<WithId<Room>[]> {
  const collection = await getRoomsCollection();
  return collection
    .find({
      isPublic: true,
      status: "waiting", // Only show rooms waiting to start
    })
    .limit(limit)
    .skip(skip)
    .toArray();
}

// Get all rooms (public and private)
export async function getAllRooms(
  limit: number = 20,
  skip: number = 0
): Promise<WithId<Room>[]> {
  const collection = await getRoomsCollection();
  return collection
    .find({
      status: "waiting", // Only show rooms waiting to start
    })
    .sort({ createdAt: -1 }) // Sort by newest first
    .limit(limit)
    .skip(skip)
    .toArray();
}

// Get room by ID
export async function getRoomById(roomId: string): Promise<WithId<Room> | null> {
  const collection = await getRoomsCollection();
  return collection.findOne({ roomId });
}

// Get room by MongoDB ID
export async function getRoomByMongoId(id: string): Promise<WithId<Room> | null> {
  const collection = await getRoomsCollection();
  try {
    return collection.findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
}

// Get room results (leaderboard) - read-only; positions are finalized by the socket-server
export async function getRoomResults(roomId: string): Promise<WithId<RoomResult>[]> {
  const collection = await getRoomResultsCollection();
  return collection.find({ roomId }).sort({ position: 1 }).toArray();
}

// Delete room (host only, only if never started)
export async function deleteRoom(
  roomId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const collection = await getRoomsCollection();
  const room = await getRoomById(roomId);

  if (!room) {
    return { success: false, error: "Room not found" };
  }

  if (room.host.userId !== userId) {
    return { success: false, error: "Only host can delete the room" };
  }

  if (room.status !== "waiting") {
    return { success: false, error: "Cannot delete a room that has started" };
  }

  await collection.deleteOne({ roomId });
  return { success: true };
}
