// Framework-agnostic domain types: imported by the Next.js app via "@/lib/models/room"
// and by the standalone socket-server via a relative path ("../lib/models/room").
// No MongoDB/Next-specific imports here on purpose - both processes need to load this
// file directly. `_id` is intentionally omitted: these are wire/domain shapes, not
// MongoDB documents (the driver's WithId<T>/OptionalId<T> add `_id` only where used).

export interface RoomParticipant {
  userId: string;
  userName: string;
  userImage?: string;
  joinedAt: Date;
  connectionStatus: "connected" | "disconnected";
  connectedAt?: Date;
  disconnectedAt?: Date; // grace-period anchor
}

export interface RoomSettings {
  mode: "time" | "words";
  timeLimit?: number; // seconds
  wordCount?: number;
  difficulty: "easy" | "normal" | "hard";
}

export interface Room {
  roomId: string; // unique room code like "ABC123"
  name: string;
  host: {
    userId: string;
    userName: string;
    userImage?: string;
  };
  isPublic: boolean;
  passwordHash?: string | null; // for private rooms
  settings: RoomSettings;
  status: "waiting" | "active" | "finished";
  participants: RoomParticipant[];
  maxParticipants: number;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  testText?: string; // The text participants need to type
  lastActivityAt: Date;
  waitingExpiresAt?: Date; // TTL anchor, only set while status === "waiting"
  abandoned?: boolean; // force-finished by the stale-room sweep, not by a host action
}

export type ResultFinishReason =
  | "completed"
  | "dnf-disconnect"
  | "dnf-timeout"
  | "dnf-host-ended";

export interface RoomResult {
  roomId: string;
  userId: string;
  userName: string;
  userImage?: string;
  wpm: number;
  accuracy: number;
  elapsedTime: number;
  charsTyped: number;
  correctChars: number;
  dnf: boolean;
  finishReason: ResultFinishReason;
  flagged: boolean;
  position: number;
  createdAt: Date;
}
