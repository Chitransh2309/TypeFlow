"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/header";
import { RoomLobby, RoomContest, RoomLeaderboard, type LiveProgressEntry } from "@/components/rooms";
import { useSocketRoom, type ConnectionPhase } from "@/hooks/use-socket-room";
import { Room } from "@/lib/models/room";
import type { AckResponse } from "@/lib/socket-events";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

type PageStatus = "loading" | "ready" | "not-found";

const PENDING_PASSWORD_PREFIX = "room:pendingPassword:";

const CONTEST_FINISHED_MESSAGES: Record<string, string> = {
  "all-finished": "Everyone finished!",
  "time-expired": "Time's up!",
  abandoned: "Everyone left - the contest was ended",
};

const ROOM_DELETED_MESSAGES: Record<string, string> = {
  "host-left-empty": "The room was closed",
  "waiting-expired": "This room expired from inactivity",
};

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [testText, setTestText] = useState("");
  const [contestStartMs, setContestStartMs] = useState<number | undefined>(undefined);
  const [liveProgress, setLiveProgress] = useState<Record<string, LiveProgressEntry>>({});
  const [isStarting, setIsStarting] = useState(false);
  const [pendingPassword, setPendingPassword] = useState<string | undefined>(undefined);
  const [hasReadPassword, setHasReadPassword] = useState(false);
  const passwordConsumedRef = useRef(false);

  // A join dialog may have stashed a private room's password just before
  // navigating here (never in a URL query string) - read it once and clear it.
  // Guarded by a ref (not just the effect running once) because React Strict
  // Mode double-invokes effects in development: without the guard, the second
  // invocation finds the key already deleted and overwrites pendingPassword
  // with undefined, silently turning every private-room join into one with no
  // password.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (passwordConsumedRef.current) {
      setHasReadPassword(true);
      return;
    }
    passwordConsumedRef.current = true;
    const key = `${PENDING_PASSWORD_PREFIX}${roomId}`;
    const stashed = sessionStorage.getItem(key);
    if (stashed) sessionStorage.removeItem(key);
    setPendingPassword(stashed || undefined);
    setHasReadPassword(true);
  }, [roomId]);

  // Non-live snapshot so there's something to render while the socket
  // connects (and a way to distinguish "room truly doesn't exist" from
  // "still connecting").
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetch(`/api/rooms/${roomId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Room not found");
        return res.json();
      })
      .then((data: Room) => {
        setRoom(data);
        setPageStatus("ready");
      })
      .catch(() => setPageStatus("not-found"));
  }, [roomId, status, router]);

  const {
    connectionPhase,
    joinStatus,
    joinDeniedCode,
    error: socketError,
    sendProgress,
    startContest,
    submitResult,
    leaveRoom,
    retry,
  } = useSocketRoom({
    roomId: hasReadPassword ? roomId : undefined,
    userId: session?.user?.id,
    password: pendingPassword,
    roomStatus: room?.status,
    onJoined: (joinedRoom) => {
      setRoom(joinedRoom);
      // Reconnecting/joining an already-active room (e.g. a page refresh
      // mid-contest) - contest:started won't fire again, so pick up the
      // shared start time from the room snapshot itself.
      if (joinedRoom.startedAt) {
        setContestStartMs(new Date(joinedRoom.startedAt).getTime());
      }
    },
    onJoinError: (err) => {
      toast({ title: "Couldn't join room", description: err, variant: "destructive" });
    },
    onRoomUpdated: (data) => {
      setRoom((prev) =>
        prev ? { ...prev, participants: data.participants, status: data.status } : prev
      );
    },
    onParticipantConnectionChanged: (data) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.userId === data.userId ? { ...p, connectionStatus: data.status } : p
          ),
        };
      });
    },
    onHostChanged: (data) => {
      setRoom((prev) =>
        prev
          ? { ...prev, host: { ...prev.host, userId: data.newHostUserId, userName: data.newHostUserName } }
          : prev
      );
      toast({ title: "Host changed", description: `${data.newHostUserName} is now the host` });
    },
    onUserJoined: (data) => {
      toast({ title: "User joined", description: `${data.userName} joined the room` });
    },
    onUserLeft: () => {
      toast({ title: "User left", description: "A participant left the room" });
    },
    onContestStarted: (data) => {
      setTestText(data.testText);
      setContestStartMs(new Date(data.startedAt).getTime());
      setLiveProgress({});
      setRoom((prev) => (prev ? { ...prev, status: "active", testText: data.testText } : prev));
    },
    onProgressUpdate: (data) => {
      setLiveProgress((prev) => ({
        ...prev,
        [data.userId]: {
          userName: data.userName,
          wpm: data.wpm,
          accuracy: data.accuracy,
          progress: data.progress,
          isFinished: false,
          dnf: false,
        },
      }));
    },
    onUserFinished: (data) => {
      setLiveProgress((prev) => ({
        ...prev,
        [data.userId]: {
          userName: prev[data.userId]?.userName || "",
          wpm: data.wpm,
          accuracy: data.accuracy,
          progress: 100,
          isFinished: true,
          dnf: data.dnf,
        },
      }));
    },
    onContestFinished: (data) => {
      setRoom((prev) => (prev ? { ...prev, status: "finished" } : prev));
      toast({ title: "Contest finished", description: CONTEST_FINISHED_MESSAGES[data.reason] });
    },
    onRoomDeleted: (data) => {
      toast({
        title: "Room closed",
        description: ROOM_DELETED_MESSAGES[data.reason],
        variant: "destructive",
      });
      router.push("/rooms");
    },
  });

  const handleStartContest = useCallback(() => {
    setIsStarting(true);
    startContest(roomId, (res: AckResponse) => {
      setIsStarting(false);
      if (!res.success) {
        toast({ title: "Couldn't start contest", description: res.error, variant: "destructive" });
      }
    });
  }, [roomId, startContest, toast]);

  const handleLeaveRoom = useCallback(() => {
    leaveRoom(roomId);
    router.push("/rooms");
  }, [roomId, leaveRoom, router]);

  const handleSendProgress = useCallback(
    (data: { charIndex: number; wpm: number; accuracy: number }) => {
      sendProgress(roomId, data);
    },
    [roomId, sendProgress]
  );

  const handleSubmitResult = useCallback(
    (data: { charsTyped: number; correctChars: number }, onResult?: (res: AckResponse) => void) => {
      submitResult(roomId, data, onResult);
    },
    [roomId, submitResult]
  );

  if (pageStatus === "loading" || status === "loading") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </main>
      </div>
    );
  }

  if (pageStatus === "not-found" || !room) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">This room doesn&apos;t exist or has been closed.</p>
          <Button onClick={() => router.push("/rooms")}>Back to Rooms</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        {connectionPhase !== "connected" ? (
          <ConnectingState phase={connectionPhase} error={socketError} onRetry={retry} />
        ) : joinStatus === "denied" &&
          !(joinDeniedCode === "not_waiting" && room.status === "finished" && room.isPublic) ? (
          <JoinDeniedState error={socketError} onBack={() => router.push("/rooms")} />
        ) : joinStatus !== "joined" && joinStatus !== "denied" ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Spinner className="h-8 w-8 text-primary" />
            <p className="font-medium">Joining room…</p>
          </div>
        ) : room.status === "waiting" ? (
          <RoomLobby
            room={room}
            onStartContest={handleStartContest}
            onLeaveRoom={handleLeaveRoom}
            isLoading={isStarting}
          />
        ) : room.status === "active" && contestStartMs !== undefined ? (
          <RoomContest
            room={room}
            testText={testText || room.testText || ""}
            contestStartMs={contestStartMs}
            currentUserId={session?.user?.id || ""}
            liveProgress={liveProgress}
            onLeaveRoom={handleLeaveRoom}
            onSendProgress={handleSendProgress}
            onSubmitResult={handleSubmitResult}
          />
        ) : room.status === "active" ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <RoomLeaderboard room={room} onLeaveRoom={handleLeaveRoom} />
        )}
      </main>
    </div>
  );
}

function ConnectingState({
  phase,
  error,
  onRetry,
}: {
  phase: ConnectionPhase;
  error: string | null;
  onRetry: () => void;
}) {
  if (phase === "failed") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold">Couldn&apos;t connect to the game server</p>
          {error && <p className="text-sm text-muted-foreground mt-1">{error}</p>}
        </div>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <Spinner className="h-8 w-8 text-primary" />
      <p className="font-medium">
        {phase === "waking" ? "Waking up the game server…" : "Connecting…"}
      </p>
      {phase === "waking" && (
        <p className="text-sm text-muted-foreground max-w-sm">
          This server spins down when idle to stay free to run - it can take up to a
          minute to wake back up. Thanks for your patience.
        </p>
      )}
    </div>
  );
}

function JoinDeniedState({
  error,
  onBack,
}: {
  error: string | null;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div>
        <p className="font-semibold">Couldn&apos;t join room</p>
        {error && <p className="text-sm text-muted-foreground mt-1">{error}</p>}
      </div>
      <Button onClick={onBack}>Back to Rooms</Button>
    </div>
  );
}
