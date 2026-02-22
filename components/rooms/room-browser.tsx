"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Loader2, Lock, Users, Clock, BarChart3 } from "lucide-react";
import { Room } from "@/lib/models/room";

export function RoomBrowser() {
  const router = useRouter();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Fetch public rooms
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch("/api/rooms");
        if (!res.ok) throw new Error("Failed to fetch rooms");
        const data = await res.json();
        setRooms(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load rooms",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
    // Refresh every 10 seconds
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, [toast]);

  const handleJoinRoom = async (room: Room) => {
    if (!room.isPublic && !joinPassword) {
      setSelectedRoom(room);
      return;
    }
    await joinRoomConfirm(room);
  };

  const joinRoomConfirm = async (room: Room) => {
    setIsJoining(true);
    try {
      const res = await fetch(`/api/rooms/${room.roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: joinPassword || undefined }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to join room");
      }

      toast({ title: "Success", description: `Joined room "${room.name}"` });
      setSelectedRoom(null);
      setJoinPassword("");
      router.push(`/rooms/${room.roomId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join room",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Input
        placeholder="Search rooms by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      {/* Rooms Grid */}
      {filteredRooms.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              {searchTerm ? "No rooms found matching your search" : "No public rooms available yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => (
            <Card key={room.roomId} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{room.name}</CardTitle>
                      <Badge variant={room.isPublic ? "default" : "secondary"} className="text-xs">
                        {room.isPublic ? "Public" : "Private"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Room ID: {room.roomId}
                    </CardDescription>
                  </div>
                  {!room.isPublic && <Lock className="h-4 w-4 text-yellow-600 mt-1 flex-shrink-0" />}
                </div>
              </CardHeader>

              <CardContent className="pb-4">
                {/* Room Info */}
                <div className="space-y-3 mb-4">
                  {/* Host */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={room.host.userImage || ""} />
                      <AvatarFallback>
                        {room.host.userName.substring(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-600">{room.host.userName}</span>
                  </div>

                  {/* Participants */}
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    <span>
                      {room.participants.length}/{room.maxParticipants} joined
                    </span>
                  </div>

                  {/* Settings */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {room.settings.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {room.settings.mode === "time"
                        ? `${room.settings.timeLimit}s`
                        : `${room.settings.wordCount}w`}
                    </Badge>
                  </div>
                </div>

                {/* Join Button */}
                <Button
                  onClick={() => handleJoinRoom(room)}
                  disabled={
                    room.participants.length >= room.maxParticipants || isJoining
                  }
                  className="w-full"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join Room"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Join Private Room Dialog */}
      <Dialog open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Private Room</DialogTitle>
            <DialogDescription>
              This room is password protected. Please enter the password to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter room password"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && selectedRoom && joinRoomConfirm(selectedRoom)}
              disabled={isJoining}
            />
            <Button
              onClick={() => selectedRoom && joinRoomConfirm(selectedRoom)}
              disabled={isJoining || !joinPassword}
              className="w-full"
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Room"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
