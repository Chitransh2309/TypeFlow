"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface UserProgressCardProps {
  userId: string;
  userName: string;
  userImage?: string;
  wpm: number;
  accuracy: number;
  progress: number; // 0-100
  isCurrentUser?: boolean;
  isFinished?: boolean;
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
}: UserProgressCardProps) {
  return (
    <Card
      className={`p-4 ${
        isCurrentUser ? "border-2 border-blue-500 bg-blue-50" : ""
      } ${isFinished ? "opacity-75" : ""}`}
    >
      {/* User Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userImage || ""} />
            <AvatarFallback>{userName.substring(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold text-sm">{userName}</p>
            {isCurrentUser && <p className="text-xs text-blue-600">You</p>}
          </div>
        </div>
        {isFinished && <Badge variant="secondary">Finished</Badge>}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">Progress</span>
          <span className="text-sm font-semibold text-gray-900">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-600">WPM</p>
          <p className="text-lg font-bold">{Math.round(wpm)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Accuracy</p>
          <p className={`text-lg font-bold ${accuracy >= 95 ? "text-green-600" : accuracy >= 90 ? "text-blue-600" : "text-orange-600"}`}>
            {accuracy.toFixed(1)}%
          </p>
        </div>
      </div>
    </Card>
  );
}
