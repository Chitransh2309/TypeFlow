"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Room } from "@/lib/models/room";
import { RoomResult } from "@/lib/models/room";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Loader2, RotateCcw } from "lucide-react";

interface RoomLeaderboardProps {
  room: Room;
  onLeaveRoom: () => void;
  onPlayAgain?: () => void;
}

export function RoomLeaderboard({
  room,
  onLeaveRoom,
  onPlayAgain,
}: RoomLeaderboardProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [results, setResults] = useState<RoomResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch results
  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/rooms/${room.roomId}/results`);
        if (!res.ok) throw new Error("Failed to fetch results");
        const data = await res.json();
        setResults(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load results",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [room.roomId, toast]);

  const getMedalEmoji = (position: number): string => {
    switch (position) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  const currentUserResult = results.find(
    (r) => r.userId === session?.user?.id
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">Contest Results</h1>
        </div>
        <p className="text-gray-600">{room.name}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Results */}
        <div className="lg:col-span-2 space-y-4">
          {results.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">
                  No results yet
                </p>
              </CardContent>
            </Card>
          ) : (
            results.map((result, idx) => (
              <Card
                key={result._id}
                className={`${
                  result.userId === session?.user?.id
                    ? "border-2 border-blue-500 bg-blue-50"
                    : ""
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    {/* Rank and User Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-12 h-12">
                        {idx < 3 ? (
                          <span className="text-3xl">
                            {getMedalEmoji(idx + 1)}
                          </span>
                        ) : (
                          <span className="text-xl font-bold text-gray-500">
                            #{idx + 1}
                          </span>
                        )}
                      </div>

                      <Avatar className="h-10 w-10">
                        <AvatarImage src={result.userImage || ""} />
                        <AvatarFallback>
                          {result.userName.substring(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <p className="font-semibold">{result.userName}</p>
                        <p className="text-xs text-gray-500">
                          {result.elapsedTime.toFixed(1)}s
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">WPM</p>
                        <p className="text-2xl font-bold">{result.wpm}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Accuracy</p>
                        <p
                          className={`text-2xl font-bold ${
                            result.accuracy >= 95
                              ? "text-green-600"
                              : result.accuracy >= 90
                                ? "text-blue-600"
                                : "text-orange-600"
                          }`}
                        >
                          {result.accuracy.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* You Badge */}
                    {result.userId === session?.user?.id && (
                      <Badge className="ml-4">You</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Your Score */}
          {currentUserResult && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">Your Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Position</p>
                    <p className="text-3xl font-bold">#{currentUserResult.position}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">WPM</p>
                    <p className="text-3xl font-bold">{currentUserResult.wpm}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Accuracy</p>
                  <p className="text-2xl font-bold text-green-600">
                    {currentUserResult.accuracy.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Participants</span>
                <span className="font-semibold">{results.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Winner WPM</span>
                <span className="font-semibold">
                  {results[0]?.wpm || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Accuracy</span>
                <span className="font-semibold">
                  {results.length > 0
                    ? (
                        results.reduce((sum, r) => sum + r.accuracy, 0) /
                        results.length
                      ).toFixed(1)
                    : "-"}
                  %
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            {onPlayAgain && (
              <Button onClick={onPlayAgain} className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" />
                Play Again
              </Button>
            )}
            <Button onClick={onLeaveRoom} variant="outline" className="w-full">
              Leave Room
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
