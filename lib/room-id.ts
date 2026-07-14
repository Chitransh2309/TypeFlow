import { customAlphabet } from "nanoid";

// Uppercase alphanumeric, excluding visually ambiguous characters (0/O, 1/I).
// customAlphabet guarantees an exact length (unlike the old nanoid(6).toUpperCase()
// .replace(/[^A-Z0-9]/g, "") approach, which could silently shrink below 6 chars
// whenever nanoid's default alphabet produced a "-" or "_").
const nanoidRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function generateRoomId(): string {
  return nanoidRoomCode();
}
