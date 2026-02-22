"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { RoomParticipant } from "@/lib/models/room";

export interface ProgressUpdate {
  userId: string;
  userName: string;
  currentWordIndex: number;
  charIndex: number;
  wpm: number;
  accuracy: number;
  progress: number;
}

interface UseSocketRoomOptions {
  roomId?: string;
  userId?: string;
  userName?: string;
  onRoomUpdated?: (data: { participants: RoomParticipant[]; status: string }) => void;
  onUserJoining?: (data: { userId: string; userName: string }) => void;
  onUserJoined?: (data: { userId: string; userName: string }) => void;
  onUserLeft?: (data: { userId: string }) => void;
  onContestStarted?: (data: { testText: string; startedAt: Date }) => void;
  onProgressUpdate?: (progress: ProgressUpdate) => void;
  onUserFinished?: (data: { userId: string; wpm: number; accuracy: number; elapsedTime: number }) => void;
  onContestFinished?: (data: { finishedAt: Date }) => void;
  onRoomDeleted?: (data: { message: string }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useSocketRoom(options: UseSocketRoomOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only initialize if we have roomId and userId
    if (!options.roomId || !options.userId) return;

    // Get the correct socket server URL with fallback
    const socketUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

    // Initialize socket connection
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      console.log("[v0] Socket Connected, socket ID:", socket.id);
      setIsConnected(true);
      options.onConnected?.();

      // Join the room
      console.log("[v0] Attempting to join room:", options.roomId);
      
      let timeoutId: NodeJS.Timeout | null = null;
      
      socket.emit(
        "join:room",
        {
          roomId: options.roomId,
          userId: options.userId,
          userName: options.userName,
        },
        (response: any) => {
          if (timeoutId) clearTimeout(timeoutId);
          
          if (!response.success) {
            console.log("[v0] Join room error:", response.error);
            setError(response.error);
          } else {
            console.log("[v0] Successfully joined room");
          }
        }
      );
      
      // Set 10 second timeout for join:room callback
      timeoutId = setTimeout(() => {
        console.log("[v0] Join room timeout - no response from server");
        setError("Failed to join room - timeout");
      }, 10000);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
      options.onDisconnected?.();
    });

    socket.on("connect_error", (error: any) => {
      console.error("[Socket] Connection error:", error);
      setError(error.message);
    });

    // Room events
    socket.on("room:updated", (data) => {
      options.onRoomUpdated?.(data);
    });

    socket.on("user:joining", (data) => {
      options.onUserJoining?.(data);
    });

    socket.on("user:joined", (data) => {
      options.onUserJoined?.(data);
    });

    socket.on("user:left", (data) => {
      options.onUserLeft?.(data);
    });

    socket.on("room:started", (data) => {
      options.onContestStarted?.(data);
    });

    socket.on("progress:update", (progress) => {
      options.onProgressUpdate?.(progress);
    });

    socket.on("user:finished", (data) => {
      options.onUserFinished?.(data);
    });

    socket.on("room:finished", (data) => {
      options.onContestFinished?.(data);
    });

    socket.on("room:deleted", (data) => {
      options.onRoomDeleted?.(data);
    });

    // Cleanup on unmount
    return () => {
      // Emit leave room event before disconnecting
      if (options.roomId && options.userId) {
        socket.emit("leave:room", {
          roomId: options.roomId,
          userId: options.userId,
        });
      }
      socket.disconnect(true); // Force disconnect
    };
  }, [options.roomId, options.userId, options.onConnected, options.onDisconnected, options.onRoomDeleted, options.onUserJoining, options.onUserJoined, options.onUserLeft, options.onRoomUpdated, options.onContestStarted, options.onProgressUpdate, options.onUserFinished, options.onContestFinished]);

  // Handle page unload (closing tab/browser)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current && options.roomId && options.userId) {
        console.log("[v0] beforeunload - disconnecting socket");
        // Emit leave room event
        socketRef.current.emit("leave:room", {
          roomId: options.roomId,
          userId: options.userId,
        }, () => {
          console.log("[v0] Leave room callback received");
        });
        // Force immediate disconnect without waiting for acknowledgement
        socketRef.current.disconnect(true);
      }
    };

    const handleUnload = () => {
      if (socketRef.current && options.roomId && options.userId) {
        console.log("[v0] unload - disconnecting socket");
        // Disconnect without emitting at this point (beforeunload should have done it)
        socketRef.current.disconnect(true);
      }
    };

    const handlePageHide = () => {
      if (socketRef.current && options.roomId && options.userId) {
        console.log("[v0] pagehide - disconnecting socket");
        socketRef.current.emit("leave:room", {
          roomId: options.roomId,
          userId: options.userId,
        });
        socketRef.current.disconnect(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);
    document.addEventListener("pagehide", handlePageHide);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
      document.removeEventListener("pagehide", handlePageHide);
    };
  }, [options.roomId, options.userId]);

  const joinRoom = (roomId: string, userId: string, userName: string) => {
    if (!socketRef.current) return;

    socketRef.current.emit(
      "join:room",
      { roomId, userId, userName },
      (response: any) => {
        if (!response.success) {
          setError(response.error);
        }
      }
    );
  };

  const leaveRoom = (roomId: string, userId: string, isHost?: boolean) => {
    if (!socketRef.current) return;
    socketRef.current.emit("leave:room", { roomId, userId, isHost });
  };

  const sendProgress = (roomId: string, progress: ProgressUpdate) => {
    if (!socketRef.current) return;
    socketRef.current.emit("progress:send", { roomId, progress });
  };

  const startContest = (roomId: string, userId: string, testText: string) => {
    if (!socketRef.current) return;

    let timeoutId: NodeJS.Timeout | null = null;
    
    socketRef.current.emit(
      "start:contest",
      { roomId, userId, testText },
      (response: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (!response.success) {
          setError(response.error);
        }
      }
    );
    
    // Set 10 second timeout for start:contest callback
    timeoutId = setTimeout(() => {
      console.log("[v0] Start contest timeout - no response from server");
      setError("Failed to start contest - timeout");
    }, 10000);
  };

  const submitResult = (roomId: string, userId: string, result: any) => {
    if (!socketRef.current) return;

    socketRef.current.emit(
      "result:submit",
      { roomId, userId, result },
      (response: any) => {
        if (!response.success) {
          setError(response.error);
        }
      }
    );
  };

  const endContest = (roomId: string, userId: string) => {
    if (!socketRef.current) return;

    socketRef.current.emit(
      "end:contest",
      { roomId, userId },
      (response: any) => {
        if (!response.success) {
          setError(response.error);
        }
      }
    );
  };

  return {
    isConnected,
    error,
    joinRoom,
    leaveRoom,
    sendProgress,
    startContest,
    submitResult,
    endContest,
  };
}
