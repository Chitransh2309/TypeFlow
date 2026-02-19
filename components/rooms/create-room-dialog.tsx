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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function CreateRoomDialog() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    isPublic: true,
    password: "",
    mode: "time" as "time" | "words",
    timeLimit: 60,
    wordCount: 50,
    difficulty: "normal" as "easy" | "normal" | "hard",
    maxParticipants: 10,
  });

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) {
      toast({ title: "Error", description: "Please sign in first" });
      return;
    }

    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Room name is required" });
      return;
    }

    if (!formData.isPublic && !formData.password) {
      toast({ title: "Error", description: "Password required for private rooms" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          isPublic: formData.isPublic,
          password: formData.isPublic ? undefined : formData.password,
          settings: {
            mode: formData.mode,
            ...(formData.mode === "time" && { timeLimit: formData.timeLimit }),
            ...(formData.mode === "words" && { wordCount: formData.wordCount }),
            difficulty: formData.difficulty,
          },
          maxParticipants: formData.maxParticipants,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create room");
      }

      const room = await res.json();
      toast({ title: "Success", description: `Room "${room.name}" created!` });
      setOpen(false);
      router.push(`/rooms/${room.roomId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create room",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Room</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Typing Contest Room</DialogTitle>
          <DialogDescription>
            Set up a new room with your preferred settings and invite others to compete
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateRoom} className="space-y-6">
          {/* Room Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Room Name</Label>
            <Input
              id="name"
              placeholder="e.g., Morning Speed Challenge"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
            />
          </div>

          {/* Room Type */}
          <div className="space-y-2">
            <Label>Room Type</Label>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {formData.isPublic ? "Public" : "Private (Password Protected)"}
              </span>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password for Private Rooms */}
          {!formData.isPublic && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter room password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Test Mode */}
          <div className="space-y-2">
            <Label htmlFor="mode">Test Mode</Label>
            <Select
              value={formData.mode}
              onValueChange={(value: any) => setFormData({ ...formData, mode: value })}
              disabled={isLoading}
            >
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">Time Based</SelectItem>
                <SelectItem value="words">Words Based</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mode Specific Settings */}
          {formData.mode === "time" && (
            <div className="space-y-2">
              <Label htmlFor="timeLimit">Time Limit (seconds)</Label>
              <Select
                value={formData.timeLimit.toString()}
                onValueChange={(value) => setFormData({ ...formData, timeLimit: parseInt(value) })}
                disabled={isLoading}
              >
                <SelectTrigger id="timeLimit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.mode === "words" && (
            <div className="space-y-2">
              <Label htmlFor="wordCount">Word Count</Label>
              <Select
                value={formData.wordCount.toString()}
                onValueChange={(value) => setFormData({ ...formData, wordCount: parseInt(value) })}
                disabled={isLoading}
              >
                <SelectTrigger id="wordCount">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 words</SelectItem>
                  <SelectItem value="50">50 words</SelectItem>
                  <SelectItem value="100">100 words</SelectItem>
                  <SelectItem value="200">200 words</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Difficulty */}
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              value={formData.difficulty}
              onValueChange={(value: any) => setFormData({ ...formData, difficulty: value })}
              disabled={isLoading}
            >
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Max Participants */}
          <div className="space-y-2">
            <Label htmlFor="maxParticipants">Max Participants</Label>
            <Select
              value={formData.maxParticipants.toString()}
              onValueChange={(value) => setFormData({ ...formData, maxParticipants: parseInt(value) })}
              disabled={isLoading}
            >
              <SelectTrigger id="maxParticipants">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 9 }, (_, i) => i + 2).map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} participants
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Room
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
