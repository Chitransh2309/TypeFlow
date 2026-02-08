import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

// POST - Save a test result
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db("typeflow");

    const result = {
      userId: session.user.id,
      userName: session.user.name ?? "Anonymous",
      userImage: session.user.image ?? null,
      wpm: body.wpm,
      rawWpm: body.rawWpm,
      accuracy: body.accuracy,
      consistency: body.consistency,
      correctChars: body.correctChars,
      incorrectChars: body.incorrectChars,
      totalChars: body.totalChars,
      elapsedTime: body.elapsedTime,
      mode: body.mode,
      modeValue: body.modeValue,
      difficulty: body.difficulty,
      createdAt: new Date(),
    };

    const inserted = await db.collection("testResults").insertOne(result);

    return NextResponse.json({
      id: inserted.insertedId.toString(),
      ...result,
    });
  } catch (error) {
    console.error("Error saving test result:", error);
    return NextResponse.json(
      { error: "Failed to save test result" },
      { status: 500 }
    );
  }
}

// GET - Get test history for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("typeflow");

    const results = await db
      .collection("testResults")
      .find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching test history:", error);
    return NextResponse.json(
      { error: "Failed to fetch test history" },
      { status: 500 }
    );
  }
}

// DELETE - Clear test history for current user
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("typeflow");

    await db
      .collection("testResults")
      .deleteMany({ userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing history:", error);
    return NextResponse.json(
      { error: "Failed to clear history" },
      { status: 500 }
    );
  }
}
