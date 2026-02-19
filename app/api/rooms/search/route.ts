import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code || code.trim().length === 0) {
      return NextResponse.json(
        { error: "Room code is required" },
        { status: 400 }
      );
    }

    // Search for room by roomId (code)
    const room = await db.room.findUnique({
      where: { roomId: code.toUpperCase() },
      select: {
        roomId: true,
        name: true,
        isPublic: true,
        settings: true,
        maxParticipants: true,
        status: true,
        participants: {
          select: { userId: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    // Don't expose password, but indicate if room is private
    return NextResponse.json({
      roomId: room.roomId,
      name: room.name,
      isPublic: room.isPublic,
      settings: room.settings,
      maxParticipants: room.maxParticipants,
      status: room.status,
      currentParticipants: room.participants.length,
    });
  } catch (error) {
    console.error("Error searching for room:", error);
    return NextResponse.json(
      { error: "Failed to search for room" },
      { status: 500 }
    );
  }
}
