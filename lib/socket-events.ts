import type { Room, RoomParticipant } from "./models/room";

// The full client<->server socket contract. Imported by the Next.js app
// (via "@/lib/socket-events") and by the standalone socket-server (via a
// relative path, e.g. "../lib/socket-events") - kept dependency-free so
// both sides can load it directly without pulling in Next.js or Mongo.

export interface AckResponse {
  success: boolean;
  error?: string;
}

export type RoomJoinErrorCode =
  | "not_found"
  | "not_waiting"
  | "full"
  | "password_required"
  | "invalid_password";

export interface RoomJoinAck extends AckResponse {
  room?: Room;
  code?: RoomJoinErrorCode;
}

// Client -> Server
export interface ClientToServerEvents {
  "room:join": (
    data: { roomId: string; password?: string },
    ack: (res: RoomJoinAck) => void
  ) => void;
  "room:leave": (data: { roomId: string }) => void;
  "progress:send": (data: {
    roomId: string;
    charIndex: number;
    wpm: number;
    accuracy: number;
  }) => void;
  "contest:start": (
    data: { roomId: string },
    ack: (res: AckResponse) => void
  ) => void;
  "result:submit": (
    data: { roomId: string; charsTyped: number; correctChars: number },
    ack: (res: AckResponse) => void
  ) => void;
}

export type ContestFinishedReason = "time-expired" | "all-finished" | "abandoned";
export type RoomDeletedReason = "host-left-empty" | "waiting-expired";

// Server -> Client
export interface ServerToClientEvents {
  "room:updated": (data: {
    participants: RoomParticipant[];
    status: Room["status"];
  }) => void;
  "participant:connection-changed": (data: {
    userId: string;
    status: "connected" | "disconnected";
  }) => void;
  "room:host-changed": (data: {
    newHostUserId: string;
    newHostUserName: string;
  }) => void;
  "user:joined": (data: { userId: string; userName: string }) => void;
  "user:left": (data: { userId: string }) => void;
  "contest:started": (data: { testText: string; startedAt: string }) => void;
  "progress:update": (data: {
    userId: string;
    userName: string;
    charIndex: number;
    wpm: number;
    accuracy: number;
    progress: number;
  }) => void;
  "user:finished": (data: {
    userId: string;
    wpm: number;
    accuracy: number;
    elapsedTime: number;
    dnf: boolean;
    flagged: boolean;
  }) => void;
  "contest:finished": (data: {
    finishedAt: string;
    reason: ContestFinishedReason;
  }) => void;
  "room:deleted": (data: { reason: RoomDeletedReason }) => void;
}

export interface SocketAuthUser {
  userId: string;
  userName: string;
  userImage?: string;
}
