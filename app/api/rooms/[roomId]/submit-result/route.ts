import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveRoomResult } from "@/lib/rooms";

// POST /api/rooms/:roomId/submit-result - Submit typing result
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
    const { wpm, accuracy, elapsedTime, position } = body;

    // Validation
    if (typeof wpm !== "number" || typeof accuracy !== "number" || typeof elapsedTime !== "number") {
      return NextResponse.json(
        { error: "Invalid result data" },
        { status: 400 }
      );
    }

    await saveRoomResult({
      roomId,
      userId: session.user.id,
      userName: session.user.name || "Anonymous",
      userImage: session.user.image,
      wpm: Math.round(wpm),
      accuracy: Math.min(100, Math.max(0, accuracy)),
      elapsedTime,
      position: position || 1,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting result:", error);
    return NextResponse.json(
      { error: "Failed to submit result" },
      { status: 500 }
    );
  }
}
