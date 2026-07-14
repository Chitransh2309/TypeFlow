import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRoomById } from "@/lib/rooms";
import { verifyPassword } from "@/lib/password";

// POST /api/rooms/:roomId/verify-password - lets the Join Room dialog check a
// private room's password up front, so a wrong password can be shown inline
// there instead of only surfacing once room:join runs over the socket
// connection (which is still the sole source of truth actually gating entry).
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
    const { password } = await request.json();

    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.isPublic || !room.passwordHash) {
      return NextResponse.json({ valid: true });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ valid: false });
    }

    const valid = await verifyPassword(password, room.passwordHash);
    return NextResponse.json({ valid });
  } catch (error) {
    console.error("Error verifying room password:", error);
    return NextResponse.json(
      { error: "Failed to verify password" },
      { status: 500 }
    );
  }
}
