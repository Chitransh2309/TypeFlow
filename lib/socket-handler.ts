import { Server as HTTPServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { getRoomById, endContest } from "@/lib/rooms";
import { RoomParticipant } from "@/lib/models/room";

let io: IOServer | null = null;

export interface ProgressUpdate {
  userId: string;
  userName: string;
  currentWordIndex: number;
  charIndex: number;
  wpm: number;
  accuracy: number;
  progress: number; // percentage
}

export interface RoomState {
  roomId: string;
  status: "waiting" | "active" | "finished";
  participants: RoomParticipant[];
  userProgress: Map<string, ProgressUpdate>;
}

// Store room states
const roomStates = new Map<string, RoomState>();

// Store socket to user mapping
const socketToUser = new Map<string, { userId: string; roomId: string }>();

export function initializeSocket(httpServer: HTTPServer): IOServer {
  if (io) return io;

  io = new IOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log("[Socket] User connected:", socket.id);

    // Join room
    socket.on("join:room", async (data: { roomId: string; userId: string; userName: string }, callback) => {
      try {
        const { roomId, userId, userName } = data;

        // Get room info
        const room = await getRoomById(roomId);
        if (!room) {
          callback({ success: false, error: "Room not found" });
          return;
        }

        // Store socket mapping
        socketToUser.set(socket.id, { userId, roomId });

        // Join socket to room namespace
        socket.join(`room:${roomId}`);

        // Initialize or update room state
        if (!roomStates.has(roomId)) {
          roomStates.set(roomId, {
            roomId,
            status: room.status as "waiting" | "active" | "finished",
            participants: room.participants,
            userProgress: new Map(),
          });
        }

        const roomState = roomStates.get(roomId)!;
        roomState.status = room.status as "waiting" | "active" | "finished";
        roomState.participants = room.participants;

        // Broadcast room update to all users
        io!.to(`room:${roomId}`).emit("room:updated", {
          participants: room.participants,
          status: room.status,
        });

        // Notify others that user joined
        socket.to(`room:${roomId}`).emit("user:joined", {
          userId,
          userName,
        });

        callback({ success: true, room });
      } catch (error) {
        console.error("[Socket] Error joining room:", error);
        callback({ success: false, error: "Failed to join room" });
      }
    });

    // Leave room
    socket.on("leave:room", async (data: { roomId: string; userId: string; isHost?: boolean }) => {
      try {
        const { roomId, userId, isHost } = data;

        socketToUser.delete(socket.id);
        socket.leave(`room:${roomId}`);

        // If host leaves, emit room:deleted to all clients
        if (isHost) {
          io!.to(`room:${roomId}`).emit("room:deleted", {
            message: "Host left the room - room has been deleted",
          });
        } else {
          // Notify others that user left
          io!.to(`room:${roomId}`).emit("user:left", { userId });
        }

        // If room is empty or no one is in the room, clean up
        const roomClients = await io!.to(`room:${roomId}`).fetchSockets();
        if (roomClients.length === 0) {
          roomStates.delete(roomId);
        }
      } catch (error) {
        console.error("[Socket] Error leaving room:", error);
      }
    });

    // Send progress update
    socket.on("progress:send", (data: { roomId: string; progress: ProgressUpdate }) => {
      try {
        const { roomId, progress } = data;
        const roomState = roomStates.get(roomId);

        if (!roomState) {
          return;
        }

        // Update progress in room state
        roomState.userProgress.set(progress.userId, progress);

        // Broadcast to all users in room
        io!.to(`room:${roomId}`).emit("progress:update", progress);
      } catch (error) {
        console.error("[Socket] Error sending progress:", error);
      }
    });

    // Start contest (host only)
    socket.on("start:contest", async (data: { roomId: string; userId: string; testText: string }, callback) => {
      try {
        const { roomId, userId, testText } = data;
        const userInfo = socketToUser.get(socket.id);

        // Verify user is in the room
        if (!userInfo || userInfo.roomId !== roomId) {
          callback({ success: false, error: "Not in room" });
          return;
        }

        const room = await getRoomById(roomId);
        if (!room) {
          callback({ success: false, error: "Room not found" });
          return;
        }

        if (room.host.userId !== userId) {
          callback({ success: false, error: "Only host can start contest" });
          return;
        }

        // Update room state
        const roomState = roomStates.get(roomId);
        if (roomState) {
          roomState.status = "active";
          roomState.userProgress.clear(); // Reset progress for all users
        }

        // Broadcast contest start to all users
        io!.to(`room:${roomId}`).emit("room:started", {
          testText,
          startedAt: new Date(),
        });

        callback({ success: true });
      } catch (error) {
        console.error("[Socket] Error starting contest:", error);
        callback({ success: false, error: "Failed to start contest" });
      }
    });

    // Submit result
    socket.on("result:submit", async (data: { roomId: string; userId: string; result: any }, callback) => {
      try {
        const { roomId, userId, result } = data;

        const userInfo = socketToUser.get(socket.id);
        if (!userInfo || userInfo.roomId !== roomId) {
          callback({ success: false, error: "Not in room" });
          return;
        }

        // Notify room about result submission
        io!.to(`room:${roomId}`).emit("user:finished", {
          userId,
          wpm: result.wpm,
          accuracy: result.accuracy,
          elapsedTime: result.elapsedTime,
        });

        callback({ success: true });
      } catch (error) {
        console.error("[Socket] Error submitting result:", error);
        callback({ success: false, error: "Failed to submit result" });
      }
    });

    // End contest
    socket.on("end:contest", async (data: { roomId: string; userId: string }, callback) => {
      try {
        const { roomId, userId } = data;
        const userInfo = socketToUser.get(socket.id);

        if (!userInfo || userInfo.roomId !== roomId) {
          callback({ success: false, error: "Not in room" });
          return;
        }

        const room = await getRoomById(roomId);
        if (!room || room.host.userId !== userId) {
          callback({ success: false, error: "Only host can end contest" });
          return;
        }

        // End contest in database
        await endContest(roomId);

        // Update room state
        const roomState = roomStates.get(roomId);
        if (roomState) {
          roomState.status = "finished";
        }

        // Notify all users
        io!.to(`room:${roomId}`).emit("room:finished", {
          finishedAt: new Date(),
        });

        callback({ success: true });
      } catch (error) {
        console.error("[Socket] Error ending contest:", error);
        callback({ success: false, error: "Failed to end contest" });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("[Socket] User disconnected:", socket.id);
      const userInfo = socketToUser.get(socket.id);
      if (userInfo) {
        io!.to(`room:${userInfo.roomId}`).emit("user:left", {
          userId: userInfo.userId,
        });
      }
      socketToUser.delete(socket.id);
    });
  });

  return io;
}

export function getIO(): IOServer | null {
  return io;
}

export function getRoomState(roomId: string): RoomState | undefined {
  return roomStates.get(roomId);
}
