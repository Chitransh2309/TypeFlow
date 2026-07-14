import "dotenv/config";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server as IOServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../../lib/socket-events";
import type { SocketAuthUser } from "../../lib/socket-events";
import { socketAuthMiddleware } from "./auth/socket-auth-middleware";
import { registerRoomHandlers } from "./rooms/handlers";
import { ensureIndexes } from "./db/indexes";
import { startSweep } from "./sweep";

const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

const httpServer = createServer(app);

export interface SocketData {
  user: SocketAuthUser;
  roomId?: string;
}

const io = new IOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  {
    cors: {
      origin: ALLOWED_ORIGIN,
      credentials: false,
    },
    transports: ["websocket", "polling"],
  }
);

io.use(socketAuthMiddleware);

io.on("connection", (socket) => {
  registerRoomHandlers(io, socket);
});

async function main() {
  await ensureIndexes();
  startSweep(io);

  httpServer.listen(PORT, () => {
    console.log(`[socket-server] listening on port ${PORT}, allowed origin: ${ALLOWED_ORIGIN}`);
  });
}

main().catch((err) => {
  console.error("[socket-server] fatal startup error:", err);
  process.exit(1);
});
