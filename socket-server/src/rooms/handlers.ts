import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../../lib/socket-events";
import type { RoomParticipant } from "../../../lib/models/room";
import { computeWpm, scoreResult } from "../../../lib/anti-cheat";
import * as roomsDb from "../db/rooms";
import * as resultsDb from "../db/results";
import * as state from "./room-state";
import { generateTestText } from "./test-text";
import type { SocketData } from "../index";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const PROGRESS_MIN_INTERVAL_MS = 100;
const GRACE_PERIOD_PARTICIPANT_MS = 20_000;
const GRACE_PERIOD_HOST_MS = 50_000;

const JOIN_ERROR_MESSAGES: Record<string, string> = {
  not_found: "Room not found",
  not_waiting: "This room is no longer accepting new participants",
  full: "Room is full",
  password_required: "Password required",
  invalid_password: "Invalid password",
};

const START_ERROR_MESSAGES: Record<string, string> = {
  not_found: "Room not found",
  not_host: "Only the host can start the contest",
  not_waiting: "Contest has already started or finished",
  not_enough_participants: "Need at least 2 participants to start",
};

function roomChannel(roomId: string) {
  return `room:${roomId}`;
}

/** Among candidates, prefer someone the process still has a live socket for;
 * otherwise fall back to the earliest-joined remaining participant. */
function pickHostSuccessor(
  participants: RoomParticipant[],
  connectedUserIds: string[],
  excludeUserId: string
): RoomParticipant | undefined {
  const remaining = participants.filter((p) => p.userId !== excludeUserId);
  const connectedSet = new Set(connectedUserIds);
  const connectedRemaining = remaining
    .filter((p) => connectedSet.has(p.userId))
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  if (connectedRemaining.length > 0) return connectedRemaining[0];
  return remaining.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
}

export function registerRoomHandlers(io: AppServer, socket: AppSocket) {
  const user = socket.data.user;

  socket.on("room:join", async (data, ack) => {
    try {
      const { roomId, password } = data;

      // Switching rooms without a page reload: cleanly detach from the previous one first.
      if (socket.data.roomId && socket.data.roomId !== roomId) {
        await handleExplicitLeave(io, socket, socket.data.roomId);
      }

      const result = await roomsDb.joinRoom(
        roomId,
        user.userId,
        user.userName,
        user.userImage,
        password
      );

      if (!result.ok) {
        ack({
          success: false,
          error: JOIN_ERROR_MESSAGES[result.error] || "Failed to join room",
          code: result.error,
        });
        return;
      }

      socket.join(roomChannel(roomId));
      socket.data.roomId = roomId;

      const wasDisconnected = state.addConnection(roomId, user.userId, socket.id);

      if (result.alreadyJoined && wasDisconnected) {
        // Reconnect within (or after) the grace window - cancel any pending timer.
        state.cancelGraceTimer(roomId, user.userId);
        await roomsDb.setParticipantConnectionStatus(roomId, user.userId, "connected");
        // result.room was read before the update above, so it still has this
        // participant's *previous* connectionStatus - patch it in place so
        // the ack and the room:updated broadcast below don't hand out stale
        // "disconnected" data (which would otherwise stick the reconnecting
        // client, and everyone else, with a permanent "Reconnecting" badge
        // for them since no further connection-status event will ever fire
        // for this transition again).
        result.room.participants = result.room.participants.map((p) =>
          p.userId === user.userId
            ? { ...p, connectionStatus: "connected" as const, connectedAt: new Date() }
            : p
        );
        io.to(roomChannel(roomId)).emit("participant:connection-changed", {
          userId: user.userId,
          status: "connected",
        });
      }

      const { passwordHash: _passwordHash, ...safeRoom } = result.room;
      ack({ success: true, room: safeRoom });

      io.to(roomChannel(roomId)).emit("room:updated", {
        participants: result.room.participants,
        status: result.room.status,
      });

      if (!result.alreadyJoined) {
        socket.to(roomChannel(roomId)).emit("user:joined", {
          userId: user.userId,
          userName: user.userName,
        });
      }
    } catch (err) {
      console.error("[socket-server] room:join error:", err);
      ack({ success: false, error: "Failed to join room" });
    }
  });

  socket.on("room:leave", async (data) => {
    try {
      if (socket.data.roomId !== data.roomId) return;
      await handleExplicitLeave(io, socket, data.roomId);
    } catch (err) {
      console.error("[socket-server] room:leave error:", err);
    }
  });

  socket.on("progress:send", (data) => {
    try {
      if (socket.data.roomId !== data.roomId) return;
      if (!state.allowProgressEmit(socket.id, PROGRESS_MIN_INTERVAL_MS)) return;

      const { roomId, charIndex, wpm, accuracy } = data;
      state.setProgress(roomId, user.userId, { userName: user.userName, charIndex, wpm, accuracy });

      const testTextLength = state.getTestTextLength(roomId) || 0;
      const progress = testTextLength > 0 ? Math.min(100, (charIndex / testTextLength) * 100) : 0;

      io.to(roomChannel(roomId)).emit("progress:update", {
        userId: user.userId,
        userName: user.userName,
        charIndex,
        wpm,
        accuracy,
        progress,
      });
    } catch (err) {
      console.error("[socket-server] progress:send error:", err);
    }
  });

  socket.on("contest:start", async (data, ack) => {
    try {
      const { roomId } = data;
      if (socket.data.roomId !== roomId) {
        ack({ success: false, error: "Not in room" });
        return;
      }

      const room = await roomsDb.getRoomById(roomId);
      if (!room) {
        ack({ success: false, error: "Room not found" });
        return;
      }

      const testText = generateTestText(room.settings);
      const result = await roomsDb.startContest(roomId, user.userId, testText);

      if (!result.ok) {
        ack({ success: false, error: START_ERROR_MESSAGES[result.error] || "Failed to start contest" });
        return;
      }

      const startedAtMs = Date.now();
      state.setContestStart(roomId, startedAtMs);
      state.setTestTextLength(roomId, testText.length);
      state.clearRoomProgress(roomId);

      ack({ success: true });
      io.to(roomChannel(roomId)).emit("contest:started", {
        testText,
        startedAt: new Date(startedAtMs).toISOString(),
      });

      if (room.settings.mode === "time" && room.settings.timeLimit) {
        state.scheduleContestTimer(roomId, room.settings.timeLimit * 1000, () => {
          finishContest(io, roomId, "time-expired").catch((err) =>
            console.error("[socket-server] time-expired finish error:", err)
          );
        });
      }
    } catch (err) {
      console.error("[socket-server] contest:start error:", err);
      ack({ success: false, error: "Failed to start contest" });
    }
  });

  socket.on("result:submit", async (data, ack) => {
    try {
      const { roomId, charsTyped, correctChars } = data;
      if (socket.data.roomId !== roomId) {
        ack({ success: false, error: "Not in room" });
        return;
      }

      const startedAtMs = state.getContestStart(roomId);
      const testTextLength = state.getTestTextLength(roomId);
      if (startedAtMs === undefined || testTextLength === undefined) {
        ack({ success: false, error: "Contest is not active" });
        return;
      }

      const scored = scoreResult({
        charsTyped,
        correctChars,
        elapsedMs: Date.now() - startedAtMs,
        testTextLength,
        lastKnownCharIndex: state.getProgress(roomId, user.userId)?.charIndex ?? 0,
      });

      if (scored.rejected) {
        ack({ success: false, error: scored.rejectReason || "Result rejected" });
        return;
      }

      await resultsDb.upsertResult({
        roomId,
        userId: user.userId,
        userName: user.userName,
        userImage: user.userImage,
        wpm: scored.wpm,
        accuracy: scored.accuracy,
        elapsedTime: scored.elapsedTime,
        charsTyped: scored.charsTyped,
        correctChars: scored.correctChars,
        dnf: false,
        finishReason: "completed",
        flagged: scored.flagged,
      });
      await roomsDb.touchActivity(roomId);

      ack({ success: true });
      io.to(roomChannel(roomId)).emit("user:finished", {
        userId: user.userId,
        wpm: scored.wpm,
        accuracy: scored.accuracy,
        elapsedTime: scored.elapsedTime,
        dnf: false,
        flagged: scored.flagged,
      });

      // No host "End Contest" button anymore - a contest only ends via the
      // time-mode timer or here, once every participant has a result (covers
      // word-mode, which has no timer, and also lets a time-mode contest end
      // early instead of idling out the rest of the clock).
      const room = await roomsDb.getRoomById(roomId);
      if (room) {
        const resultCount = await resultsDb.countResults(roomId);
        if (resultCount >= room.participants.length) {
          await finishContest(io, roomId, "all-finished");
        }
      }
    } catch (err) {
      console.error("[socket-server] result:submit error:", err);
      ack({ success: false, error: "Failed to submit result" });
    }
  });

  socket.on("disconnect", async () => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const wasLast = state.removeConnection(roomId, user.userId, socket.id);
      state.cleanupSocket(socket.id);
      if (!wasLast) return; // user still has another live tab/socket in this room

      const room = await roomsDb.getRoomById(roomId);
      const isHost = room?.host.userId === user.userId;
      const delayMs = isHost ? GRACE_PERIOD_HOST_MS : GRACE_PERIOD_PARTICIPANT_MS;

      await roomsDb.setParticipantConnectionStatus(roomId, user.userId, "disconnected");
      io.to(roomChannel(roomId)).emit("participant:connection-changed", {
        userId: user.userId,
        status: "disconnected",
      });

      state.scheduleGraceTimer(roomId, user.userId, delayMs, () => {
        finalizeUserGone(io, roomId, user.userId).catch((err) =>
          console.error("[socket-server] finalizeUserGone error:", err)
        );
      });
    } catch (err) {
      console.error("[socket-server] disconnect handler error:", err);
    }
  });
}

/** Explicit room:leave (or switching rooms) - skips the grace period entirely
 * and finalizes the departure immediately. */
async function handleExplicitLeave(io: AppServer, socket: AppSocket, roomId: string) {
  const user = socket.data.user;
  socket.leave(roomChannel(roomId));
  const wasLast = state.removeConnection(roomId, user.userId, socket.id);
  state.cleanupSocket(socket.id);
  if (socket.data.roomId === roomId) socket.data.roomId = undefined;

  if (!wasLast) return; // another tab is still in this room

  state.cancelGraceTimer(roomId, user.userId);
  await finalizeUserGone(io, roomId, user.userId);
}

/** Runs once a user is confirmed fully gone from a room - either immediately
 * (explicit leave) or after their disconnect grace period expires. */
async function finalizeUserGone(io: AppServer, roomId: string, userId: string) {
  state.cancelGraceTimer(roomId, userId);

  const room = await roomsDb.getRoomById(roomId);
  if (!room) return; // already deleted

  if (room.status === "waiting") {
    const { deleted, room: updated } = await roomsDb.leaveWaitingRoom(roomId, userId);
    if (!updated) return;

    if (deleted) {
      state.cleanupRoom(roomId);
      io.to(roomChannel(roomId)).emit("room:deleted", { reason: "host-left-empty" });
      return;
    }

    if (userId === room.host.userId) {
      const successor = pickHostSuccessor(updated.participants, state.connectedUserIds(roomId), userId);
      if (successor) {
        await roomsDb.migrateHost(roomId, {
          userId: successor.userId,
          userName: successor.userName,
          userImage: successor.userImage,
        });
        io.to(roomChannel(roomId)).emit("room:host-changed", {
          newHostUserId: successor.userId,
          newHostUserName: successor.userName,
        });
      }
    }

    io.to(roomChannel(roomId)).emit("user:left", { userId });
    io.to(roomChannel(roomId)).emit("room:updated", {
      participants: updated.participants,
      status: updated.status,
    });
    return;
  }

  if (room.status === "active") {
    const alreadySubmitted = await resultsDb.hasResult(roomId, userId);
    if (!alreadySubmitted) {
      const lastProgress = state.getProgress(roomId, userId);
      const startedAtMs = state.getContestStart(roomId);
      const elapsedTime = startedAtMs !== undefined ? (Date.now() - startedAtMs) / 1000 : 0;
      const charsTyped = lastProgress?.charIndex ?? 0;
      const correctChars = lastProgress
        ? Math.round(charsTyped * (lastProgress.accuracy / 100))
        : 0;

      const participant = room.participants.find((p) => p.userId === userId);
      await resultsDb.upsertResultIfAbsent({
        roomId,
        userId,
        userName: participant?.userName || lastProgress?.userName || "Anonymous",
        userImage: participant?.userImage,
        // Recomputed over the full elapsedTime, not lastProgress.wpm - that's
        // frozen at whatever their rate was the moment they stopped typing
        // (or disconnected), so it'd overstate them for however long they
        // then sat idle before this ran.
        wpm: Math.round(computeWpm(correctChars, elapsedTime * 1000)),
        accuracy: lastProgress?.accuracy ?? 0,
        elapsedTime,
        charsTyped,
        correctChars,
        dnf: true,
        finishReason: "dnf-disconnect",
        flagged: false,
      });

      // Re-fetch rather than trusting the DNF data just built: if a genuine
      // result:submit landed in the narrow window between the hasResult
      // check above and now, upsertResultIfAbsent was a no-op and the DB
      // holds the real result - broadcast what's actually there, not a stale
      // DNF guess.
      const finalResult = await resultsDb.getResult(roomId, userId);
      if (finalResult) {
        io.to(roomChannel(roomId)).emit("user:finished", {
          userId,
          wpm: finalResult.wpm,
          accuracy: finalResult.accuracy,
          elapsedTime: finalResult.elapsedTime,
          dnf: finalResult.dnf,
          flagged: finalResult.flagged,
        });
      }
    }

    io.to(roomChannel(roomId)).emit("user:left", { userId });

    if (userId === room.host.userId) {
      const remainingConnected = state.connectedUserIds(roomId).filter((id) => id !== userId);
      if (remainingConnected.length > 0) {
        const successor = pickHostSuccessor(room.participants, remainingConnected, userId);
        if (successor) {
          await roomsDb.migrateHost(roomId, {
            userId: successor.userId,
            userName: successor.userName,
            userImage: successor.userImage,
          });
          io.to(roomChannel(roomId)).emit("room:host-changed", {
            newHostUserId: successor.userId,
            newHostUserName: successor.userName,
          });
        }
      }
    }

    // Nobody left at all takes priority over "everyone has a result": if this
    // departure was also the last live connection, it's an abandonment even
    // if it happened to complete the result set (e.g. everyone DNF'd out one
    // by one) - "all-finished" should only fire while someone's still around
    // to have finished into.
    if (state.connectedUserCount(roomId) === 0) {
      // Conditioned on status:"active" and reports whether it actually won -
      // two simultaneous last-departures (e.g. a network blip that drops
      // everyone at once) can both reach this branch, but only the winner
      // should finalize/emit.
      const abandoned = await roomsDb.abandonActiveRoom(roomId);
      if (abandoned) {
        await resultsDb.finalizePositions(roomId);
        state.clearContestTiming(roomId);
        io.to(roomChannel(roomId)).emit("contest:finished", {
          finishedAt: new Date().toISOString(),
          reason: "abandoned",
        });
      }
      return;
    }

    // This departure may have been the last missing result (e.g. the last
    // straggler disconnecting instead of finishing) - without this check a
    // word-mode room would sit "active" forever once everyone still connected
    // has already submitted, since nothing else would trigger a finish.
    const resultCount = await resultsDb.countResults(roomId);
    if (resultCount >= room.participants.length) {
      await finishContest(io, roomId, "all-finished");
    }
  }
}

/** Shared by the time-mode auto-completion timer and the "everyone has a
 * result now" check (after a result:submit or a disconnect-driven DNF). */
async function finishContest(
  io: AppServer,
  roomId: string,
  reason: "time-expired" | "all-finished"
) {
  const room = await roomsDb.getRoomById(roomId);
  if (!room || room.status !== "active") return;

  const startedAtMs = state.getContestStart(roomId);
  const elapsedTime = startedAtMs !== undefined ? (Date.now() - startedAtMs) / 1000 : 0;

  // For time mode, running out the clock is the normal, successful way a
  // contest ends - a time-mode participant almost never reaches the last
  // word themselves (test-text.ts deliberately over-generates words so a
  // fast typist never runs dry), so this loop is their *only* path to a
  // result. Marking them DNF here would mislabel every timed contest's
  // entire leaderboard. "all-finished" shouldn't reach this loop at all
  // (that's its trigger condition) - dnf-timeout is a defensive fallback.
  const isTimeExpired = reason === "time-expired";

  for (const participant of room.participants) {
    const already = await resultsDb.hasResult(roomId, participant.userId);
    if (already) continue;

    const lastProgress = state.getProgress(roomId, participant.userId);
    const charsTyped = lastProgress?.charIndex ?? 0;
    const correctChars = lastProgress
      ? Math.round(charsTyped * (lastProgress.accuracy / 100))
      : 0;

    await resultsDb.upsertResultIfAbsent({
      roomId,
      userId: participant.userId,
      userName: participant.userName,
      userImage: participant.userImage,
      // Recomputed over the full elapsedTime, not lastProgress.wpm - that's
      // frozen at whatever their rate was the moment they stopped typing, so
      // it'd overstate anyone who slowed down or paused before time ran out.
      wpm: Math.round(computeWpm(correctChars, elapsedTime * 1000)),
      accuracy: lastProgress?.accuracy ?? 0,
      elapsedTime,
      charsTyped,
      correctChars,
      dnf: !isTimeExpired,
      finishReason: isTimeExpired ? "completed" : "dnf-timeout",
      flagged: false,
    });

    // Re-fetch rather than trusting the DNF data just built: if a genuine
    // result:submit landed between the hasResult check above and now,
    // upsertResultIfAbsent was a no-op - broadcast the real stored result.
    const finalResult = await resultsDb.getResult(roomId, participant.userId);
    if (finalResult) {
      io.to(roomChannel(roomId)).emit("user:finished", {
        userId: participant.userId,
        wpm: finalResult.wpm,
        accuracy: finalResult.accuracy,
        elapsedTime: finalResult.elapsedTime,
        dnf: finalResult.dnf,
        flagged: finalResult.flagged,
      });
    }
  }

  // Conditioned on status:"active" and reports whether it actually won - two
  // concurrent triggers (e.g. two participants' result:submit both seeing
  // "everyone's done" at once, or this racing the time-mode timer) can both
  // reach here, but only the winner should finalize/emit. The DNF-fill loop
  // above is safe to run twice either way (upsertResultIfAbsent is a no-op
  // for anyone already recorded).
  const ended = await roomsDb.endContest(roomId);
  if (!ended) return;

  await resultsDb.finalizePositions(roomId);
  state.clearContestTiming(roomId);

  io.to(roomChannel(roomId)).emit("contest:finished", {
    finishedAt: new Date().toISOString(),
    reason,
  });
}
