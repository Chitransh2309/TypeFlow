import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "all";

    const client = await clientPromise;
    const db = client.db("typeflow");

    // Build date filter
    let dateFilter = {};
    const now = new Date();
    if (timeframe === "daily") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: start } };
    } else if (timeframe === "weekly") {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      dateFilter = { createdAt: { $gte: start } };
    } else if (timeframe === "monthly") {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      dateFilter = { createdAt: { $gte: start } };
    }

    // Aggregate: group by user, take their best WPM, average accuracy, count tests
    const leaderboard = await db
      .collection("testResults")
      .aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$userId",
            userName: { $last: "$userName" },
            userImage: { $last: "$userImage" },
            bestWpm: { $max: "$wpm" },
            avgAccuracy: { $avg: "$accuracy" },
            testCount: { $sum: 1 },
          },
        },
        { $sort: { bestWpm: -1 } },
        { $limit: 50 },
      ])
      .toArray();

    const results = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry._id,
      userName: entry.userName || "Anonymous",
      userImage: entry.userImage,
      wpm: entry.bestWpm,
      accuracy: Math.round(entry.avgAccuracy * 10) / 10,
      tests: entry.testCount,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
