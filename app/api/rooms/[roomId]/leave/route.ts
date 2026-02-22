import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { leaveRoom, getRoomById } from "@/lib/rooms";

// POST /api/rooms/:roomId/leave - Leave a room
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;

    // Check if user is host before leaving
    const room = await getRoomById(roomId);
    const isHost = room?.host.userId === session.user.id;

    const result = await leaveRoom(roomId, session.user.id);

    return NextResponse.json({ success: true, deleted: result.deleted, wasHost: isHost });
  } catch (error) {
    console.error("Error leaving room:", error);
    return NextResponse.json(
      { error: "Failed to leave room" },
      { status: 500 }
    );
  }
}
