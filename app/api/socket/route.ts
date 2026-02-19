import { NextRequest, NextResponse } from "next/server";
import { initializeSocket } from "@/lib/socket-handler";

// This route handles Socket.io connections
// Socket.io works through HTTP upgrade, not traditional REST
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "Socket.io endpoint - use WebSocket connection" });
}
