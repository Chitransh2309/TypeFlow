import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startContest, getRoomById } from "@/lib/rooms";

// POST /api/rooms/:roomId/start - Start contest
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
    const body = await request.json();
    const { testText } = body;

    if (!testText) {
      return NextResponse.json(
        { error: "Test text is required" },
        { status: 400 }
      );
    }

    const result = await startContest(roomId, session.user.id, testText);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { passwordHash, ...roomData } = room;
    return NextResponse.json(roomData);
  } catch (error) {
    console.error("Error starting contest:", error);
    return NextResponse.json(
      { error: "Failed to start contest" },
      { status: 500 }
    );
  }
}
