import type { Socket } from "socket.io";
import { verifySocketAuthToken, SocketAuthError } from "./verify-token";

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
) {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string" || !token) {
    next(new Error("Missing auth token"));
    return;
  }

  try {
    const user = verifySocketAuthToken(token);
    socket.data.user = user;
    next();
  } catch (err) {
    next(err instanceof SocketAuthError ? err : new Error("Authentication failed"));
  }
}
