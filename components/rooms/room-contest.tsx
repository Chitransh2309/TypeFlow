"use client";

import { useMemo } from "react";
import { Room } from "@/lib/models/room";
import type { AckResponse } from "@/lib/socket-events";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings-context";
import { useRoomTyping } from "@/hooks/use-room-typing";
import { TypingArea } from "@/components/typing";
import { UserProgressCard } from "./user-progress-card";
import { Loader2 } from "lucide-react";

export interface LiveProgressEntry {
  userName: string;
  wpm: number;
  accuracy: number;
  progress: number;
  isFinished: boolean;
  dnf: boolean;
}

interface RoomContestProps {
  room: Room;
  testText: string;
  contestStartMs: number;
  currentUserId: string;
  liveProgress: Record<string, LiveProgressEntry>;
  onLeaveRoom: () => void;
  onSendProgress: (data: { charIndex: number; wpm: number; accuracy: number }) => void;
  onSubmitResult: (
    data: { charsTyped: number; correctChars: number },
    onResult?: (res: AckResponse) => void
  ) => void;
}

export function RoomContest({
  room,
  testText,
  contestStartMs,
  currentUserId,
  liveProgress,
  onLeaveRoom,
  onSendProgress,
  onSubmitResult,
}: RoomContestProps) {
  const { toast } = useToast();
  const { settings } = useSettings();

  const {
    words,
    charStates,
    currentWordIndex,
    isActive,
    isFinished,
    elapsedTime,
    wpm,
    accuracy,
    progress,
    inputRef,
    handleKeyDown,
    focusInput,
  } = useRoomTyping({
    testText,
    contestStartMs,
    roomId: room.roomId,
    onProgress: onSendProgress,
    onFinished: (data) => {
      onSubmitResult(data, (res) => {
        if (!res.success) {
          toast({ title: "Couldn't submit result", description: res.error, variant: "destructive" });
        } else {
          toast({ title: "Success", description: "Result submitted!" });
        }
      });
    },
  });

  const isTimeMode = room.settings.mode === "time";
  const timeDisplay = isTimeMode
    ? `${Math.max(0, (room.settings.timeLimit || 0) - elapsedTime)}s`
    : `${elapsedTime}s`;

  const fontSize = settings?.fontSize ?? "medium";
  const showLiveWpm = settings?.showLiveWpm ?? true;
  const showProgressBar = settings?.showProgressBar ?? true;

  const progressRows = useMemo(() => {
    return room.participants.map((participant) => {
      if (participant.userId === currentUserId) {
        return {
          userId: participant.userId,
          userName: participant.userName,
          userImage: participant.userImage,
          wpm,
          accuracy,
          progress,
          isFinished,
          connectionStatus: participant.connectionStatus,
        };
      }
      const live = liveProgress[participant.userId];
      return {
        userId: participant.userId,
        userName: participant.userName,
        userImage: participant.userImage,
        wpm: live?.wpm ?? 0,
        accuracy: live?.accuracy ?? 100,
        progress: live?.progress ?? 0,
        isFinished: live?.isFinished ?? false,
        connectionStatus: participant.connectionStatus,
      };
    });
  }, [room.participants, liveProgress, currentUserId, wpm, accuracy, progress, isFinished]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-muted-foreground">{room.name}</h1>
        </div>

        {/* Stats bar - matches the home page typing test */}
        <div className="flex items-center justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{isTimeMode ? "time" : "words"}</span>
            <span className="text-2xl font-mono font-semibold text-primary">
              {isTimeMode ? timeDisplay : `${currentWordIndex}/${words.length}`}
            </span>
          </div>
          {isActive && showLiveWpm && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">wpm</span>
              <span className="text-2xl font-mono font-semibold">{wpm}</span>
            </div>
          )}
        </div>

        {/* Progress bar - matches the home page typing test */}
        {isActive && showProgressBar && (
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <TypingArea
          words={words}
          charStates={charStates}
          currentWordIndex={currentWordIndex}
          inputRef={inputRef}
          onKeyDown={handleKeyDown}
          onClick={focusInput}
          isActive={isActive}
          fontSize={fontSize}
        />

        {isFinished && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Result submitted - waiting for the contest to finish…</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-3">Live Progress</h3>
          <div className="space-y-3">
            {progressRows.map((row) => (
              <UserProgressCard
                key={row.userId}
                userId={row.userId}
                userName={row.userName}
                userImage={row.userImage}
                wpm={row.wpm}
                accuracy={row.accuracy}
                progress={row.progress}
                isCurrentUser={row.userId === currentUserId}
                isFinished={row.isFinished}
                connectionStatus={row.connectionStatus}
              />
            ))}
          </div>
        </div>

        <Button onClick={onLeaveRoom} variant="ghost" className="w-full">
          Leave
        </Button>
      </div>
    </div>
  );
}
