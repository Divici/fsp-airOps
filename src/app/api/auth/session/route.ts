// ---------------------------------------------------------------------------
// GET /api/auth/session — Return current session data for client-side checks
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      userId: session.userId,
      email: session.email,
      operatorId: session.operatorId,
      operators: session.operators,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Failed to check session" },
      { status: 500 }
    );
  }
}
