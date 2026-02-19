"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { CreateRoomDialog } from "@/components/rooms/create-room-dialog";
import { RoomBrowser } from "@/components/rooms/room-browser";

export default function RoomsPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">Loading...</div>
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
            <p className="text-gray-600">
              Join a room to compete with other typists in real-time
            </p>
          </div>
          <CreateRoomDialog />
        </div>

        <RoomBrowser />
      </main>
    </div>
  );
}
