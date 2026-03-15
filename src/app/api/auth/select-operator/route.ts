// ---------------------------------------------------------------------------
// POST /api/auth/select-operator — Switch active operator in session
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getCurrentSession, createSession } from "@/lib/auth/session";

interface SelectOperatorBody {
  operatorId?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SelectOperatorBody;

    if (!body.operatorId || typeof body.operatorId !== "number") {
      return NextResponse.json(
        { error: "operatorId is required and must be a number" },
        { status: 400 }
      );
    }

    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify the user has access to this operator
    if (!session.operators.includes(body.operatorId)) {
      return NextResponse.json(
        { error: "Access denied for this operator" },
        { status: 403 }
      );
    }

    // Re-create session with the selected operator
    await createSession({
      userId: session.userId,
      operatorId: body.operatorId,
      token: session.token,
      email: session.email,
      operators: session.operators.map((id) => ({ id, name: `Operator ${id}` })),
    });

    return NextResponse.json({ success: true, operatorId: body.operatorId });
  } catch (error) {
    console.error("Select operator error:", error);
    return NextResponse.json(
      { error: "Failed to switch operator" },
      { status: 500 }
    );
  }
}
