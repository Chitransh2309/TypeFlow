import { NextRequest, NextResponse } from "next/server";
import { getRoomById } from "@/lib/rooms";

// GET /api/rooms/:roomId - Get room details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = await getRoomById(roomId);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Don't send password hash to client
    const { passwordHash, ...roomData } = room;
    return NextResponse.json(roomData);
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}
