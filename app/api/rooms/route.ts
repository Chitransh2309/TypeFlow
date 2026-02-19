import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createRoom, getPublicRooms } from "@/lib/rooms";
import { Room, RoomSettings } from "@/lib/models/room";

// GET /api/rooms - Get public rooms
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const skip = parseInt(searchParams.get("skip") || "0");

    const rooms = await getPublicRooms(limit, skip);
    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

// POST /api/rooms - Create new room
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      isPublic,
      password,
      settings,
      maxParticipants,
    }: {
      name: string;
      isPublic: boolean;
      password?: string;
      settings: RoomSettings;
      maxParticipants: number;
    } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 });
    }

    if (!isPublic && !password) {
      return NextResponse.json({ error: "Password required for private rooms" }, { status: 400 });
    }

    if (maxParticipants < 2 || maxParticipants > 50) {
      return NextResponse.json({ error: "Max participants must be between 2 and 50" }, { status: 400 });
    }

    const room = await createRoom({
      name,
      isPublic,
      passwordHash: !isPublic ? password : null,
      settings,
      maxParticipants,
      host: {
        userId: session.user.id,
        userName: session.user.name || "Anonymous",
        userImage: session.user.image,
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
