"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Room } from "@/lib/models/room";
import { useSocketRoom, ProgressUpdate } from "@/hooks/use-socket-room";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserProgressCard } from "./user-progress-card";
import { Loader2, Zap } from "lucide-react";

interface RoomContestProps {
  room: Room;
  testText: string;
  onLeaveRoom: () => void;
  onEndContest: () => void;
}

interface UserProgress {
  userId: string;
  userName: string;
  userImage?: string;
  wpm: number;
  accuracy: number;
  progress: number;
  isFinished: boolean;
}

export function RoomContest({
  room,
  testText,
  onLeaveRoom,
  onEndContest,
}: RoomContestProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [userProgress, setUserProgress] = useState<Map<string, UserProgress>>(new Map());
  const [typedText, setTypedText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isContestFinished, setIsContestFinished] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendProgress, submitResult, endContest, isConnected } = useSocketRoom({
    roomId: room.roomId,
    userId: session?.user?.id,
    userName: session?.user?.name,
    onProgressUpdate: (progress: ProgressUpdate) => {
      setUserProgress((prev) => {
        const updated = new Map(prev);
        updated.set(progress.userId, {
          userId: progress.userId,
          userName: progress.userName,
          wpm: progress.wpm,
          accuracy: progress.accuracy,
          progress: progress.progress,
          isFinished: false,
        });
        return updated;
      });
    },
    onUserFinished: (data) => {
      setUserProgress((prev) => {
        const updated = new Map(prev);
        const user = updated.get(data.userId);
        if (user) {
          user.isFinished = true;
        }
        return updated;
      });
    },
    onContestFinished: () => {
      setIsContestFinished(true);
    },
  });

  // Initialize current user and all participants progress
  useEffect(() => {
    const initialProgress = new Map<string, UserProgress>();

    // Initialize all participants
    room.participants.forEach((participant) => {
      initialProgress.set(participant.userId, {
        userId: participant.userId,
        userName: participant.userName,
        userImage: participant.userImage,
        wpm: 0,
        accuracy: 100,
        progress: 0,
        isFinished: false,
      });
    });

    setUserProgress(initialProgress);
    setStartTime(Date.now());
    textareaRef.current?.focus();
  }, [room.participants]);

  // Calculate typing metrics
  const calculateMetrics = (typed: string) => {
    const words = typed.trim().split(/\s+/).filter((w) => w.length > 0).length;
    const elapsed = (Date.now() - (startTime || Date.now())) / 1000 / 60; // minutes
    const wpm = Math.max(0, words / (elapsed || 1));

    // Calculate accuracy
    let correctChars = 0;
    for (let i = 0; i < Math.min(typed.length, testText.length); i++) {
      if (typed[i] === testText[i]) correctChars++;
    }
    const accuracy =
      testText.length > 0
        ? (correctChars / testText.length) * 100
        : 100;

    const progress = (typed.length / testText.length) * 100;

    return { wpm, accuracy, progress };
  };

  // Handle text input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTypedText(value);

    if (!session?.user?.id) return;

    const { wpm, accuracy, progress } = calculateMetrics(value);

    // Update local progress
    setUserProgress((prev) => {
      const updated = new Map(prev);
      updated.set(session.user.id, {
        ...updated.get(session.user.id)!,
        wpm,
        accuracy,
        progress: Math.min(100, progress),
      });
      return updated;
    });

    // Send progress to other users
    if (progress < 100) {
      sendProgress(room.roomId, {
        userId: session.user.id,
        userName: session.user.name || "Anonymous",
        currentWordIndex: typed.split(/\s+/).length,
        charIndex: typed.length,
        wpm,
        accuracy,
        progress: Math.min(100, progress),
      });
    }
  };

  // Submit result
  const handleSubmitResult = async () => {
    if (!session?.user?.id || isContestFinished || hasSubmitted) return;

    const { wpm, accuracy } = calculateMetrics(typedText);
    const elapsedTime = (Date.now() - (startTime || Date.now())) / 1000;

    setHasSubmitted(true);

    try {
      // Submit result to server
      const res = await fetch(`/api/rooms/${room.roomId}/submit-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wpm: Math.round(wpm),
          accuracy,
          elapsedTime,
          position: 1, // Will be calculated on server
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit result");
      }

      // Notify other users
      submitResult(room.roomId, session.user.id, {
        wpm: Math.round(wpm),
        accuracy,
        elapsedTime,
      });

      // Update progress
      setUserProgress((prev) => {
        const updated = new Map(prev);
        updated.set(session.user.id, {
          ...updated.get(session.user.id)!,
          isFinished: true,
        });
        return updated;
      });

      toast({ title: "Success", description: "Result submitted!" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit result",
        variant: "destructive",
      });
      setHasSubmitted(false);
    }
  };

  // Check if finished typing
  const isTypingComplete = typedText.length >= testText.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">{room.name}</h1>
          <p className="text-muted-foreground">
            {typedText.length}/{testText.length} characters
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Text Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Text to Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="p-4 bg-muted rounded-lg border border-border font-mono text-sm leading-relaxed mb-4 min-h-[150px]">
                  {testText.split("").map((char, idx) => {
                    let colorClass = "text-muted-foreground";
                    if (idx < typedText.length) {
                      colorClass =
                        typedText[idx] === char
                          ? "text-green-600 bg-green-100"
                          : "text-red-600 bg-red-100";
                    } else if (idx === typedText.length) {
                      colorClass = "text-primary bg-primary/10 animate-pulse";
                    }
                    return (
                      <span key={idx} className={colorClass}>
                        {char === " " ? "·" : char}
                      </span>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typing Area */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Type Here</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                ref={textareaRef}
                value={typedText}
                onChange={handleInputChange}
                disabled={isContestFinished}
                placeholder="Start typing..."
                className="font-mono text-sm h-32 resize-none"
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          {!isContestFinished && (
            <Button
              onClick={handleSubmitResult}
              disabled={hasSubmitted || !isTypingComplete}
              className="w-full"
            >
              {hasSubmitted ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Submit Result
                </>
              )}
            </Button>
          )}
        </div>

        {/* Sidebar - Participant Progress */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Live Progress</h3>
            <div className="space-y-3">
              {Array.from(userProgress.values()).map((progress) => (
                <UserProgressCard
                  key={progress.userId}
                  userId={progress.userId}
                  userName={progress.userName}
                  userImage={progress.userImage}
                  wpm={progress.wpm}
                  accuracy={progress.accuracy}
                  progress={progress.progress}
                  isCurrentUser={progress.userId === session?.user?.id}
                  isFinished={progress.isFinished}
                />
              ))}
            </div>
          </div>

          {/* Host End Contest Button */}
          {session?.user?.id === room.host.userId && !isContestFinished && (
            <Button
              onClick={() => {
                endContest(room.roomId, session.user.id);
                setIsContestFinished(true);
                onEndContest();
              }}
              variant="outline"
              className="w-full"
            >
              End Contest
            </Button>
          )}

          {/* Leave Button */}
          <Button
            onClick={onLeaveRoom}
            variant="ghost"
            className="w-full"
          >
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}
