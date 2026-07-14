import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { authOptions } from "@/lib/auth";

// Mints a short-lived (60s) signed token the client hands to the standalone
// socket-server (a different origin) to authenticate its Socket.io connection.
// Signed with the same secret NextAuth already uses (lib/auth.ts), so no new
// secret needs provisioning - the socket-server verifies with the same value.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured: missing AUTH_SECRET/NEXTAUTH_SECRET" },
      { status: 500 }
    );
  }

  const token = jwt.sign(
    {
      sub: session.user.id,
      name: session.user.name,
      picture: session.user.image,
      purpose: "socket-auth",
      jti: nanoid(),
    },
    secret,
    { expiresIn: "60s", algorithm: "HS256" }
  );

  return NextResponse.json({ token });
}
