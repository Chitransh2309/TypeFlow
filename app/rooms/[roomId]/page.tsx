"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/header";
import {
  RoomLobby,
  RoomContest,
  RoomLeaderboard,
} from "@/components/rooms";
import { useSocketRoom } from "@/hooks/use-socket-room";
import { Room } from "@/lib/models/room";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getRandomWords } from "@/lib/words-data";

type RoomStatus = "loading" | "lobby" | "contest" | "finished" | "error";

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("loading");
  const [testText, setTestText] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  // Socket.io connection
  const {
    isConnected,
    error: socketError,
    sendProgress,
    startContest,
    endContest,
    leaveRoom: socketLeaveRoom,
  } = useSocketRoom({
    roomId: hasJoined ? roomId : undefined,
    userId: session?.user?.id,
    userName: session?.user?.name,
    onRoomUpdated: (data) => {
      // Update room participants
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: data.participants,
          status: data.status as any,
        };
      });
    },
    onContestStarted: (data) => {
      setTestText(data.testText);
      setRoomStatus("contest");
    },
    onContestFinished: () => {
      setRoomStatus("finished");
    },
  });

  // Fetch room details
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status !== "authenticated" || !session?.user?.id) return;

    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) {
          throw new Error("Room not found");
        }
        const data: Room = await res.json();
        setRoom(data);
        setRoomStatus(
          data.status === "waiting"
            ? "lobby"
            : data.status === "active"
              ? "contest"
              : "finished"
        );

        // Check if user is already in the room
        const isInRoom = data.participants.some(
          (p) => p.userId === session.user.id
        );
        if (!isInRoom) {
          setHasJoined(false);
        } else {
          setHasJoined(true);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load room",
          variant: "destructive",
        });
        setRoomStatus("error");
        router.push("/rooms");
      }
    };

    fetchRoom();
  }, [roomId, session, status, router, toast]);

  const handleStartContest = async () => {
    if (!session?.user?.id || !room) return;

    // Check if user is host
    if (room.host.userId !== session.user.id) {
      toast({
        title: "Error",
        description: "Only the host can start the contest",
        variant: "destructive",
      });
      return;
    }

    // Check minimum participants
    if (room.participants.length < 2) {
      toast({
        title: "Error",
        description: "Need at least 2 participants to start",
        variant: "destructive",
      });
      return;
    }

    // Check room status
    if (room.status !== "waiting") {
      toast({
        title: "Error",
        description: "Contest has already started or finished",
        variant: "destructive",
      });
      return;
    }

    setIsStarting(true);
    try {
      // Get test text based on room settings
      let selectedWords: string[] = [];
      const difficulty = (room.settings.difficulty || "normal") as "easy" | "normal" | "hard";

      if (room.settings.mode === "words") {
        const count = room.settings.wordCount || 50;
        selectedWords = getRandomWords(count, difficulty);
      } else {
        // For time-based, use more words (enough for the duration)
        const estimatedWords = (room.settings.timeLimit || 60) * 5; // assume 5 WPM at least
        selectedWords = getRandomWords(estimatedWords, difficulty);
      }

      const text = selectedWords.join(" ");

      // Start contest via API
      const res = await fetch(`/api/rooms/${roomId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testText: text }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to start contest");
      }

      // Emit socket event
      startContest(roomId, session.user.id, text);
      setTestText(text);
      setRoomStatus("contest");

      toast({ title: "Success", description: "Contest started!" });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start contest",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!session?.user?.id) return;

    try {
      // Emit socket event to notify server
      socketLeaveRoom(roomId, session.user.id);

      await fetch(`/api/rooms/${roomId}/leave`, {
        method: "POST",
      });
      router.push("/rooms");
      toast({ title: "Success", description: "Left the room" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave room",
        variant: "destructive",
      });
    }
  };

  // Cleanup on page unload or component unmount
  useEffect(() => {
    return () => {
      // Attempt to leave room when component unmounts
      if (hasJoined && session?.user?.id) {
        socketLeaveRoom(roomId, session.user.id);
      }
    };
  }, [hasJoined, roomId, session?.user?.id, socketLeaveRoom]);

  const handleEndContest = async () => {
    if (!session?.user?.id || !room) return;

    try {
      endContest(roomId, session.user.id);
      setRoomStatus("finished");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to end contest",
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (roomStatus === "loading") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  // Error state
  if (roomStatus === "error" || !room) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-600">Failed to load room</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        {roomStatus === "lobby" && (
          <RoomLobby
            room={room}
            onStartContest={handleStartContest}
            onLeaveRoom={handleLeaveRoom}
            isLoading={isStarting}
          />
        )}

        {roomStatus === "contest" && (
          <RoomContest
            room={room}
            testText={testText}
            onLeaveRoom={handleLeaveRoom}
            onEndContest={handleEndContest}
          />
        )}

        {roomStatus === "finished" && (
          <RoomLeaderboard
            room={room}
            onLeaveRoom={handleLeaveRoom}
            onPlayAgain={() => {
              setRoomStatus("lobby");
              setTestText("");
              window.location.reload();
            }}
          />
        )}
      </main>
    </div>
  );
}
