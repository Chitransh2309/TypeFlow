"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { CreateRoomDialog } from "@/components/rooms/create-room-dialog";
import { JoinRoomDialog } from "@/components/rooms/join-room-dialog";
import { RoomBrowser } from "@/components/rooms/room-browser";
import { Spinner } from "@/components/ui/spinner";

export default function RoomsPage() {
  const { data: session, status } = useSession();

  // Fire-and-forget: wake the (possibly-sleeping, free-tier) socket-server as
  // early as possible, so by the time the user creates/joins a room it's
  // often already warm.
  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    if (!socketServerUrl) return;
    fetch(`${socketServerUrl}/health`, { cache: "no-store" }).catch(() => {});
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Typing Contest Rooms</h1>
            <p className="text-muted-foreground">
              Join a room to compete with other typists in real-time
            </p>
          </div>
          <div className="flex gap-2">
            <JoinRoomDialog />
            <CreateRoomDialog />
          </div>
        </div>

        <RoomBrowser />
      </main>
    </div>
  );
}
