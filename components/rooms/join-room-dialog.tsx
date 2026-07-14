"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Globe } from "lucide-react";

export function JoinRoomDialog() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [passwordError, setPasswordError] = useState(false);

  const handleSearchRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) {
      toast({ title: "Error", description: "Please sign in first" });
      return;
    }

    if (!roomCode.trim()) {
      toast({ title: "Error", description: "Room code is required" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/rooms/search?code=${roomCode}`);

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Room not found");
      }

      const room = await res.json();

      if (!room.isPublic && !password) {
        setRoomDetails(room);
        setStep("confirm");
        setIsLoading(false);
        return;
      }

      // Join the room
      handleJoinRoom(room.roomId, room.isPublic ? undefined : password);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to find room",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // The actual join (identity/atomicity/password check) happens once the room
  // page's socket connects - this just navigates there, stashing a private
  // room's password (never in a URL query string) for the room page to read once.
  const handleJoinRoom = (roomId: string, pwd?: string) => {
    if (pwd) sessionStorage.setItem(`room:pendingPassword:${roomId}`, pwd);
    setOpen(false);
    setRoomCode("");
    setPassword("");
    setPasswordError(false);
    setStep("input");
    setRoomDetails(null);
    router.push(`/rooms/${roomId}`);
  };

  const handleConfirmJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(false);

    if (roomDetails?.isPublic === false && !password.trim()) {
      toast({ title: "Error", description: "Password is required for private rooms" });
      return;
    }

    if (roomDetails?.isPublic === false) {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/rooms/${roomDetails.roomId}/verify-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setPasswordError(true);
          setIsLoading(false);
          return;
        }
      } catch {
        toast({ title: "Error", description: "Failed to verify password", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    handleJoinRoom(roomDetails.roomId, password);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Join by Code</Button>
      </DialogTrigger>
      <DialogContent>
        {step === "input" ? (
          <>
            <DialogHeader>
              <DialogTitle>Join Typing Contest Room</DialogTitle>
              <DialogDescription>
                Enter a room code to join an existing room
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSearchRoom} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  placeholder="e.g., ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  maxLength={10}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !roomCode.trim()}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Search Room
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Room Join</DialogTitle>
              <DialogDescription>
                Review room details before joining
              </DialogDescription>
            </DialogHeader>

            {roomDetails && (
              <div className="space-y-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{roomDetails.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {roomDetails.currentParticipants || 0} / {roomDetails.maxParticipants} participants
                      </p>
                    </div>
                    <div>
                      {roomDetails.isPublic ? (
                        <Globe className="h-5 w-5 text-blue-500" />
                      ) : (
                        <Lock className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Mode</p>
                      <p className="font-medium capitalize">{roomDetails.settings?.mode}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Difficulty</p>
                      <p className="font-medium capitalize">{roomDetails.settings?.difficulty}</p>
                    </div>
                  </div>
                </Card>

                <form onSubmit={handleConfirmJoin} className="space-y-4">
                  {roomDetails.isPublic === false && (
                    <div className="space-y-2">
                      <Label htmlFor="password">Room Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter room password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError(false);
                        }}
                        disabled={isLoading}
                        aria-invalid={passwordError}
                      />
                      {passwordError && (
                        <p className="text-sm text-red-500">Password is wrong</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setStep("input");
                        setPassword("");
                        setPasswordError(false);
                        setRoomDetails(null);
                      }}
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Join Room
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
