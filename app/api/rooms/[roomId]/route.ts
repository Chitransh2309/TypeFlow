import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRoomById } from "@/lib/rooms";

// GET /api/rooms/:roomId - non-live preview snapshot (the actual join, with its
// atomicity/auth/password checks, happens over the socket connection).
// For a private room the requester isn't already a participant of, the
// participant list is stripped - who's in a private room shouldn't be visible
// before the password has been verified.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;
    const room = await getRoomById(roomId);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { passwordHash, ...roomData } = room;

    const isMember = room.participants.some((p) => p.userId === session.user.id);
    if (!room.isPublic && !isMember) {
      return NextResponse.json({ ...roomData, participants: [] });
    }

    return NextResponse.json(roomData);
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}
