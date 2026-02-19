import type { Server as HTTPServer } from "http";
import type { Server as IOServer } from "socket.io";
import { initializeSocket } from "./socket-handler";

let ioInstance: IOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): IOServer {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = initializeSocket(httpServer);
  console.log("Socket.io server initialized");
  return ioInstance;
}

export function getSocketServer(): IOServer | null {
  return ioInstance;
}
