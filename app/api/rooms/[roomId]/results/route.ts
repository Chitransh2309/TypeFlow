import { NextRequest, NextResponse } from "next/server";
import { getRoomResults } from "@/lib/rooms";

// GET /api/rooms/:roomId/results - Get room results/leaderboard
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const results = await getRoomResults(roomId);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
