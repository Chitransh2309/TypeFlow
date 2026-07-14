"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UserProgressCardProps {
  userId: string;
  userName: string;
  userImage?: string;
  wpm: number;
  accuracy: number;
  progress: number; // 0-100
  isCurrentUser?: boolean;
  isFinished?: boolean;
  connectionStatus?: "connected" | "disconnected";
}

export function UserProgressCard({
  userId,
  userName,
  userImage,
  wpm,
  accuracy,
  progress,
  isCurrentUser = false,
  isFinished = false,
  connectionStatus = "connected",
}: UserProgressCardProps) {
  const isDisconnected = connectionStatus === "disconnected";

  return (
    <Card
      className={cn(
        "p-4",
        isCurrentUser && "border-2 border-primary bg-primary/5",
        isFinished && "opacity-75"
      )}
    >
      {/* User Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative shrink-0">
            <Avatar className={cn("h-8 w-8", isDisconnected && "opacity-50")}>
              <AvatarImage src={userImage || ""} />
              <AvatarFallback>{userName.substring(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            {/* Presence dot, Discord/Slack-style - a single glance says
                connected vs reconnecting without extra text taking up room */}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                isDisconnected ? "bg-muted-foreground" : "bg-green-500"
              )}
              title={isDisconnected ? "Reconnecting…" : "Connected"}
            />
          </div>
          <div className="flex-1">
            <p className={cn("font-semibold text-sm", isDisconnected && "text-muted-foreground")}>
              {userName}
            </p>
            {isCurrentUser && <p className="text-xs text-primary">You</p>}
          </div>
        </div>
        {isDisconnected ? (
          <Badge variant="outline" className="text-muted-foreground">
            Reconnecting
          </Badge>
        ) : (
          isFinished && <Badge variant="secondary">Finished</Badge>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-sm font-semibold text-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">WPM</p>
          <p className="text-lg font-bold">{Math.round(wpm)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Accuracy</p>
          <p className={`text-lg font-bold ${accuracy >= 95 ? "text-green-600" : accuracy >= 90 ? "text-blue-600" : "text-orange-600"}`}>
            {accuracy.toFixed(1)}%
          </p>
        </div>
      </div>
    </Card>
  );
}
