import jwt from "jsonwebtoken";
import type { SocketAuthUser } from "../../../lib/socket-events";

interface SocketAuthTokenClaims {
  sub: string;
  name?: string;
  picture?: string;
  purpose: string;
  jti: string;
}

// Tracks recently-seen token IDs so a literal replay of the same signed token
// within its own expiry window is rejected. Cleared lazily (short expiry
// already makes replay low-value; this is cheap extra hardening, not a
// substitute for the token's own exp claim).
const seenTokenIds = new Map<string, number>();
const REPLAY_WINDOW_MS = 70_000;

function pruneSeenTokenIds() {
  const now = Date.now();
  for (const [jti, expiresAt] of seenTokenIds) {
    if (expiresAt <= now) seenTokenIds.delete(jti);
  }
}

export class SocketAuthError extends Error {}

// Same variable, same fallback order as lib/auth.ts's NextAuth `secret` option
// (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) - this repo's
// actual .env only sets NEXTAUTH_SECRET, so that's what resolves in practice.
function getSharedSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new SocketAuthError(
      "Server misconfigured: set AUTH_SECRET or NEXTAUTH_SECRET (same value as the Next.js app)"
    );
  }
  return secret;
}

export function verifySocketAuthToken(token: string): SocketAuthUser {
  const secret = getSharedSecret();

  let claims: SocketAuthTokenClaims;
  try {
    claims = jwt.verify(token, secret, { algorithms: ["HS256"] }) as SocketAuthTokenClaims;
  } catch {
    throw new SocketAuthError("Invalid or expired token");
  }

  if (claims.purpose !== "socket-auth" || !claims.sub || !claims.jti) {
    throw new SocketAuthError("Invalid token claims");
  }

  pruneSeenTokenIds();
  if (seenTokenIds.has(claims.jti)) {
    throw new SocketAuthError("Token already used");
  }
  seenTokenIds.set(claims.jti, Date.now() + REPLAY_WINDOW_MS);

  return {
    userId: claims.sub,
    userName: claims.name || "Anonymous",
    userImage: claims.picture,
  };
}
