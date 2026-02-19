import clientPromise from "@/lib/mongodb";
import { Room, RoomResult } from "@/lib/models/room";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

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

// Generate a unique room ID (e.g., "ABC123")
export function generateRoomId(): string {
  return nanoid(6).toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
}

// Hash password for private rooms
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify password for private rooms
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create a new room
export async function createRoom(
  roomData: Omit<Room, "_id" | "roomId" | "status" | "createdAt" | "participants">
): Promise<Room> {
  const collection = await getRoomsCollection();
  const roomId = generateRoomId();
  const passwordHash = roomData.passwordHash
    ? await hashPassword(roomData.passwordHash)
    : null;

  const room: Room = {
    ...roomData,
    roomId,
    passwordHash,
    status: "waiting",
    participants: [
      {
        userId: roomData.host.userId,
        userName: roomData.host.userName,
        userImage: roomData.host.userImage,
        joinedAt: new Date(),
      },
    ],
    createdAt: new Date(),
  };

  const result = await collection.insertOne(room);
  return { ...room, _id: result.insertedId };
}

// Get public rooms
export async function getPublicRooms(
  limit: number = 20,
  skip: number = 0
): Promise<Room[]> {
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

// Get room by ID
export async function getRoomById(roomId: string): Promise<Room | null> {
  const collection = await getRoomsCollection();
  return collection.findOne({ roomId });
}

// Get room by MongoDB ID
export async function getRoomByMongoId(id: string): Promise<Room | null> {
  const collection = await getRoomsCollection();
  try {
    return collection.findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
}

// Join room
export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
  userImage: string | undefined,
  password?: string
): Promise<{ success: boolean; error?: string }> {
  const collection = await getRoomsCollection();
  const room = await getRoomById(roomId);

  if (!room) {
    return { success: false, error: "Room not found" };
  }

  if (room.status !== "waiting") {
    return { success: false, error: "Room is not accepting new participants" };
  }

  if (
    room.participants.length >=
    room.maxParticipants
  ) {
    return { success: false, error: "Room is full" };
  }

  // Check if user already in room
  if (room.participants.some((p) => p.userId === userId)) {
    return { success: false, error: "You are already in this room" };
  }

  // Verify password for private rooms
  if (!room.isPublic && room.passwordHash) {
    if (!password) {
      return { success: false, error: "Password required" };
    }
    const isValid = await verifyPassword(password, room.passwordHash);
    if (!isValid) {
      return { success: false, error: "Invalid password" };
    }
  }

  await collection.updateOne(
    { roomId },
    {
      $push: {
        participants: {
          userId,
          userName,
          userImage,
          joinedAt: new Date(),
        },
      },
    }
  );

  return { success: true };
}

// Leave room
export async function leaveRoom(
  roomId: string,
  userId: string
): Promise<void> {
  const collection = await getRoomsCollection();
  const room = await getRoomById(roomId);

  if (!room) return;

  // If room hasn't started and user is the only one, delete the room
  if (room.status === "waiting" && room.participants.length === 1) {
    await collection.deleteOne({ roomId });
    return;
  }

  // If host leaves, transfer to another user or delete room
  if (room.host.userId === userId && room.status === "waiting") {
    const otherParticipants = room.participants.filter((p) => p.userId !== userId);
    if (otherParticipants.length > 0) {
      const newHost = otherParticipants[0];
      await collection.updateOne(
        { roomId },
        {
          $set: {
            host: {
              userId: newHost.userId,
              userName: newHost.userName,
              userImage: newHost.userImage,
            },
          },
          $pull: {
            participants: { userId },
          },
        }
      );
    } else {
      await collection.deleteOne({ roomId });
    }
  } else {
    await collection.updateOne(
      { roomId },
      {
        $pull: {
          participants: { userId },
        },
      }
    );
  }
}

// Start contest
export async function startContest(
  roomId: string,
  userId: string,
  testText: string
): Promise<{ success: boolean; error?: string }> {
  const collection = await getRoomsCollection();
  const room = await getRoomById(roomId);

  if (!room) {
    return { success: false, error: "Room not found" };
  }

  if (room.host.userId !== userId) {
    return { success: false, error: "Only host can start the contest" };
  }

  if (room.status !== "waiting") {
    return { success: false, error: "Contest already started or finished" };
  }

  await collection.updateOne(
    { roomId },
    {
      $set: {
        status: "active",
        startedAt: new Date(),
        testText,
      },
    }
  );

  return { success: true };
}

// End contest
export async function endContest(roomId: string): Promise<void> {
  const collection = await getRoomsCollection();
  await collection.updateOne(
    { roomId },
    {
      $set: {
        status: "finished",
        endedAt: new Date(),
      },
    }
  );
}

// Save room result
export async function saveRoomResult(
  result: Omit<RoomResult, "_id" | "createdAt">
): Promise<void> {
  const collection = await getRoomResultsCollection();
  await collection.insertOne({
    ...result,
    createdAt: new Date(),
  });
}

// Get room results
export async function getRoomResults(roomId: string): Promise<RoomResult[]> {
  const collection = await getRoomResultsCollection();
  return collection
    .find({ roomId })
    .sort({ position: 1 })
    .toArray();
}

// Delete room (host only, only if waiting)
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
