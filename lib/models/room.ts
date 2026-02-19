import { ObjectId } from "mongodb";

export interface RoomParticipant {
  userId: string;
  userName: string;
  userImage?: string;
  joinedAt: Date;
}

export interface RoomSettings {
  mode: "time" | "words";
  timeLimit?: number; // seconds
  wordCount?: number;
  difficulty: "easy" | "normal" | "hard";
}

export interface Room {
  _id?: ObjectId;
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
}

export interface RoomResult {
  _id?: ObjectId;
  roomId: string;
  userId: string;
  userName: string;
  userImage?: string;
  wpm: number;
  accuracy: number;
  elapsedTime: number;
  position: number;
  createdAt: Date;
}
