"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Room } from "@/lib/models/room";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Clock, Zap, Copy, Check } from "lucide-react";

interface RoomLobbyProps {
  room: Room;
  onStartContest: () => void;
  onLeaveRoom: () => void;
  isLoading?: boolean;
}

export function RoomLobby({
  room,
  onStartContest,
  onLeaveRoom,
  isLoading = false,
}: RoomLobbyProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const isHost = session?.user?.id === room.host.userId;
  const isFull = room.participants.length >= room.maxParticipants;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Room code copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      {/* Room Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{room.name}</h1>
        <p className="text-gray-600">
          Waiting room • {room.participants.length}/{room.maxParticipants} participants
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Room Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contest Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Mode</p>
                  <p className="font-semibold capitalize">{room.settings.mode}-based</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Difficulty</p>
                  <p className="font-semibold capitalize">{room.settings.difficulty}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    {room.settings.mode === "time" ? "Duration" : "Words"}
                  </p>
                  <p className="font-semibold">
                    {room.settings.mode === "time"
                      ? `${room.settings.timeLimit} seconds`
                      : `${room.settings.wordCount} words`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Room Type</p>
                  <p className="font-semibold">{room.isPublic ? "Public" : "Private"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({room.participants.length}/{room.maxParticipants})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {room.participants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.userImage || ""} />
                        <AvatarFallback>
                          {participant.userName.substring(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{participant.userName}</p>
                        <p className="text-xs text-gray-500">
                          {participant.userId === room.host.userId && "Host"}
                        </p>
                      </div>
                    </div>
                    {participant.userId === session?.user?.id && (
                      <Badge variant="secondary">You</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Room Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Share Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-gray-600">Room Code</p>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-gray-100 rounded font-mono text-sm font-semibold">
                  {room.roomId}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyRoomCode}
                  className="px-2"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Host Controls */}
          {isHost && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-sm">Host Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={onStartContest}
                  disabled={isLoading || room.participants.length < 2}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Start Contest
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-600">
                  {room.participants.length < 2
                    ? "Need at least 2 participants"
                    : "Ready to start when you are!"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Leave Button */}
          <Button
            onClick={onLeaveRoom}
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            Leave Room
          </Button>

          {/* Status */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <p className="text-sm text-green-800 font-medium">
                ✓ All participants ready
              </p>
              <p className="text-xs text-green-600 mt-1">
                Waiting for host to start
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
