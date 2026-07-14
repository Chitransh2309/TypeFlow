// In-memory live state for rooms this process currently has connected sockets for.
// Single-instance design (per the plan - no Redis/cross-instance adapter yet), so
// this is the source of truth for "is anyone actually connected right now," while
// MongoDB stays the source of truth for durable room/result data.

export interface LiveProgress {
  userName: string;
  charIndex: number;
  wpm: number;
  accuracy: number;
}

const connections = new Map<string, Map<string, Set<string>>>(); // roomId -> userId -> socketIds
const progress = new Map<string, Map<string, LiveProgress>>(); // roomId -> userId -> progress
const graceTimers = new Map<string, NodeJS.Timeout>(); // `${roomId}:${userId}` -> timer
const contestTimers = new Map<string, NodeJS.Timeout>(); // roomId -> timer
const contestStartedAtMs = new Map<string, number>(); // roomId -> server wall-clock start
const testTextLengths = new Map<string, number>(); // roomId -> current contest's testText.length
const lastProgressEmitAt = new Map<string, number>(); // socketId -> ms timestamp

function roomKey(roomId: string, userId: string) {
  return `${roomId}:${userId}`;
}

/** Returns true if this is the user's first live socket in this room (was fully disconnected). */
export function addConnection(roomId: string, userId: string, socketId: string): boolean {
  let byUser = connections.get(roomId);
  if (!byUser) {
    byUser = new Map();
    connections.set(roomId, byUser);
  }
  let sockets = byUser.get(userId);
  const wasDisconnected = !sockets || sockets.size === 0;
  if (!sockets) {
    sockets = new Set();
    byUser.set(userId, sockets);
  }
  sockets.add(socketId);
  return wasDisconnected;
}

/** Returns true if this was the user's last live socket in this room (now fully disconnected). */
export function removeConnection(roomId: string, userId: string, socketId: string): boolean {
  const byUser = connections.get(roomId);
  const sockets = byUser?.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    byUser!.delete(userId);
    if (byUser!.size === 0) connections.delete(roomId);
    return true;
  }
  return false;
}

export function isConnected(roomId: string, userId: string): boolean {
  const sockets = connections.get(roomId)?.get(userId);
  return !!sockets && sockets.size > 0;
}

export function connectedUserCount(roomId: string): number {
  return connections.get(roomId)?.size ?? 0;
}

export function connectedUserIds(roomId: string): string[] {
  return Array.from(connections.get(roomId)?.keys() ?? []);
}

export function setProgress(roomId: string, userId: string, data: LiveProgress): void {
  let byUser = progress.get(roomId);
  if (!byUser) {
    byUser = new Map();
    progress.set(roomId, byUser);
  }
  byUser.set(userId, data);
}

export function getProgress(roomId: string, userId: string): LiveProgress | undefined {
  return progress.get(roomId)?.get(userId);
}

export function clearRoomProgress(roomId: string): void {
  progress.delete(roomId);
}

export function setContestStart(roomId: string, startedAtMs: number): void {
  contestStartedAtMs.set(roomId, startedAtMs);
}

export function getContestStart(roomId: string): number | undefined {
  return contestStartedAtMs.get(roomId);
}

export function clearContestStart(roomId: string): void {
  contestStartedAtMs.delete(roomId);
}

export function setTestTextLength(roomId: string, length: number): void {
  testTextLengths.set(roomId, length);
}

export function getTestTextLength(roomId: string): number | undefined {
  return testTextLengths.get(roomId);
}

/** Narrower than cleanupRoom: clears contest-timing state on contest end, but
 * leaves the connections map alone since sockets may still be viewing the leaderboard. */
export function clearContestTiming(roomId: string): void {
  clearContestStart(roomId);
  testTextLengths.delete(roomId);
  cancelContestTimer(roomId);
}

export function scheduleGraceTimer(
  roomId: string,
  userId: string,
  delayMs: number,
  callback: () => void
): void {
  cancelGraceTimer(roomId, userId);
  const timer = setTimeout(callback, delayMs);
  graceTimers.set(roomKey(roomId, userId), timer);
}

export function cancelGraceTimer(roomId: string, userId: string): void {
  const key = roomKey(roomId, userId);
  const timer = graceTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    graceTimers.delete(key);
  }
}

export function scheduleContestTimer(roomId: string, delayMs: number, callback: () => void): void {
  cancelContestTimer(roomId);
  const timer = setTimeout(callback, delayMs);
  contestTimers.set(roomId, timer);
}

export function cancelContestTimer(roomId: string): void {
  const timer = contestTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    contestTimers.delete(roomId);
  }
}

/** Drops progress:send events arriving faster than minIntervalMs from the same socket. */
export function allowProgressEmit(socketId: string, minIntervalMs: number): boolean {
  const now = Date.now();
  const last = lastProgressEmitAt.get(socketId);
  if (last !== undefined && now - last < minIntervalMs) return false;
  lastProgressEmitAt.set(socketId, now);
  return true;
}

export function cleanupSocket(socketId: string): void {
  lastProgressEmitAt.delete(socketId);
}

export function cleanupRoom(roomId: string): void {
  connections.delete(roomId);
  clearRoomProgress(roomId);
  clearContestStart(roomId);
  testTextLengths.delete(roomId);
  cancelContestTimer(roomId);
  for (const key of Array.from(graceTimers.keys())) {
    if (key.startsWith(`${roomId}:`)) {
      clearTimeout(graceTimers.get(key)!);
      graceTimers.delete(key);
    }
  }
}
