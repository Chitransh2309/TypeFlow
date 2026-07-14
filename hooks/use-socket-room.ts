"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { Room, RoomParticipant } from "@/lib/models/room";
import type {
  AckResponse,
  ClientToServerEvents,
  ContestFinishedReason,
  RoomDeletedReason,
  RoomJoinAck,
  RoomJoinErrorCode,
  ServerToClientEvents,
} from "@/lib/socket-events";

export type ConnectionPhase =
  | "idle"
  | "connecting"
  | "waking"
  | "connected"
  | "failed";

// Separate from ConnectionPhase on purpose: the socket transport can be fully
// "connected" while the room:join application-level request is still pending
// or was rejected (e.g. wrong password) - the room UI must gate on this, not
// just on the transport being connected.
export type JoinStatus = "idle" | "joining" | "joined" | "denied";

const WAKING_AFTER_MS = 5_000;
const FAILED_AFTER_MS = 75_000;

interface UseSocketRoomOptions {
  roomId?: string;
  userId?: string;
  password?: string; // only used for the very first join attempt of a private room
  // Current room status, kept fresh by the caller - used only to decide how
  // to handle pagehide (see the effect below).
  roomStatus?: Room["status"];
  onRoomUpdated?: (data: { participants: RoomParticipant[]; status: Room["status"] }) => void;
  onParticipantConnectionChanged?: (data: { userId: string; status: "connected" | "disconnected" }) => void;
  onHostChanged?: (data: { newHostUserId: string; newHostUserName: string }) => void;
  onUserJoined?: (data: { userId: string; userName: string }) => void;
  onUserLeft?: (data: { userId: string }) => void;
  onContestStarted?: (data: { testText: string; startedAt: string }) => void;
  onProgressUpdate?: (data: {
    userId: string;
    userName: string;
    charIndex: number;
    wpm: number;
    accuracy: number;
    progress: number;
  }) => void;
  onUserFinished?: (data: {
    userId: string;
    wpm: number;
    accuracy: number;
    elapsedTime: number;
    dnf: boolean;
    flagged: boolean;
  }) => void;
  onContestFinished?: (data: { finishedAt: string; reason: ContestFinishedReason }) => void;
  onRoomDeleted?: (data: { reason: RoomDeletedReason }) => void;
  onJoined?: (room: Room) => void;
  onJoinError?: (error: string) => void;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

async function mintSocketToken(): Promise<string | undefined> {
  try {
    const res = await fetch("/api/socket-token", { method: "POST" });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.token;
  } catch {
    return undefined;
  }
}

export function useSocketRoom(options: UseSocketRoomOptions) {
  const socketRef = useRef<AppSocket | null>(null);
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("idle");
  const [joinStatus, setJoinStatus] = useState<JoinStatus>("idle");
  const [joinDeniedCode, setJoinDeniedCode] = useState<RoomJoinErrorCode | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Callbacks are captured by ref (updated every render via plain assignment,
  // never inside an effect) so the connect effect below never needs them in
  // its dependency array - this is what stops the socket from tearing down
  // and reconnecting on every parent re-render (e.g. every keystroke).
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "";

  useEffect(() => {
    const { roomId, userId } = options;
    if (!roomId || !userId) return;

    if (!socketServerUrl) {
      setConnectionPhase("failed");
      setError("Socket server is not configured (NEXT_PUBLIC_SOCKET_SERVER_URL is missing)");
      return;
    }

    let wakingTimer: ReturnType<typeof setTimeout> | null = null;
    let failedTimer: ReturnType<typeof setTimeout> | null = null;

    const armPhaseTimers = () => {
      clearPhaseTimers();
      wakingTimer = setTimeout(() => setConnectionPhase("waking"), WAKING_AFTER_MS);
      failedTimer = setTimeout(() => setConnectionPhase("failed"), FAILED_AFTER_MS);
    };
    const clearPhaseTimers = () => {
      if (wakingTimer) clearTimeout(wakingTimer);
      if (failedTimer) clearTimeout(failedTimer);
      wakingTimer = null;
      failedTimer = null;
    };

    setConnectionPhase("connecting");
    armPhaseTimers();

    const socket: AppSocket = io(socketServerUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket", "polling"],
      auth: (cb: (data: { token: string }) => void) => {
        mintSocketToken().then((token) => cb({ token: token || "" }));
      },
    });

    socketRef.current = socket;

    const attemptJoin = (password?: string) => {
      setJoinStatus("joining");
      socket.emit("room:join", { roomId, password }, (response: RoomJoinAck) => {
        if (!response.success) {
          setJoinStatus("denied");
          setJoinDeniedCode(response.code);
          setError(response.error || "Failed to join room");
          callbacksRef.current.onJoinError?.(response.error || "Failed to join room");
        } else if (response.room) {
          setJoinStatus("joined");
          setJoinDeniedCode(undefined);
          setError(null);
          callbacksRef.current.onJoined?.(response.room);
        }
      });
    };

    socket.on("connect", () => {
      clearPhaseTimers();
      setConnectionPhase("connected");
      setError(null);
      attemptJoin(callbacksRef.current.password);
    });

    socket.on("disconnect", () => {
      // A disconnect while this effect is still mounted means the connection
      // dropped unexpectedly (network blip, server restart/cold-sleep) -
      // socket.io will keep retrying automatically; reflect that in the UI.
      setConnectionPhase("connecting");
      armPhaseTimers();
    });

    socket.on("connect_error", (err) => {
      setError(err.message);
    });

    socket.on("room:updated", (data) => callbacksRef.current.onRoomUpdated?.(data));
    socket.on("participant:connection-changed", (data) =>
      callbacksRef.current.onParticipantConnectionChanged?.(data)
    );
    socket.on("room:host-changed", (data) => callbacksRef.current.onHostChanged?.(data));
    socket.on("user:joined", (data) => callbacksRef.current.onUserJoined?.(data));
    socket.on("user:left", (data) => callbacksRef.current.onUserLeft?.(data));
    socket.on("contest:started", (data) => callbacksRef.current.onContestStarted?.(data));
    socket.on("progress:update", (data) => callbacksRef.current.onProgressUpdate?.(data));
    socket.on("user:finished", (data) => callbacksRef.current.onUserFinished?.(data));
    socket.on("contest:finished", (data) => callbacksRef.current.onContestFinished?.(data));
    socket.on("room:deleted", (data) => callbacksRef.current.onRoomDeleted?.(data));

    return () => {
      clearPhaseTimers();
      if (socket.connected) {
        socket.emit("room:leave", { roomId });
      }
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.roomId, options.userId, socketServerUrl]);

  // Best-effort leave on tab close. beforeunload/unload are deliberately not
  // used here (they race each other and defeat the back/forward cache);
  // pagehide covers the same case more reliably.
  //
  // Skipped entirely while a contest is active: pagehide also fires on a
  // same-tab refresh/reload, not just a real tab close, and this event
  // bypasses the disconnect grace period - for an active contest that would
  // immediately DNF the refreshing participant (and could even end the whole
  // contest early if they were the last missing result) before they get a
  // chance to reconnect. Letting the socket's own disconnect fire instead
  // routes it through the grace-period path, so a refresh is resumable and a
  // genuine tab close still finalizes shortly after via the same path.
  useEffect(() => {
    const handlePageHide = () => {
      const socket = socketRef.current;
      if (socket && options.roomId && callbacksRef.current.roomStatus !== "active") {
        socket.emit("room:leave", { roomId: options.roomId });
      }
    };
    document.addEventListener("pagehide", handlePageHide);
    return () => document.removeEventListener("pagehide", handlePageHide);
  }, [options.roomId]);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("room:leave", { roomId });
  }, []);

  const sendProgress = useCallback(
    (roomId: string, data: { charIndex: number; wpm: number; accuracy: number }) => {
      socketRef.current?.emit("progress:send", { roomId, ...data });
    },
    []
  );

  const startContest = useCallback((roomId: string, onResult?: (res: AckResponse) => void) => {
    if (!socketRef.current) return;
    socketRef.current.emit("contest:start", { roomId }, (response) => {
      if (!response.success) setError(response.error || "Failed to start contest");
      onResult?.(response);
    });
  }, []);

  const submitResult = useCallback(
    (
      roomId: string,
      data: { charsTyped: number; correctChars: number },
      onResult?: (res: AckResponse) => void
    ) => {
      if (!socketRef.current) return;
      socketRef.current.emit("result:submit", { roomId, ...data }, (response) => {
        if (!response.success) setError(response.error || "Failed to submit result");
        onResult?.(response);
      });
    },
    []
  );

  const retry = useCallback(() => {
    setConnectionPhase("connecting");
    socketRef.current?.connect();
  }, []);

  return {
    connectionPhase,
    isConnected: connectionPhase === "connected",
    joinStatus,
    joinDeniedCode,
    error,
    leaveRoom,
    sendProgress,
    startContest,
    submitResult,
    retry,
  };
}
