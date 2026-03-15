// ---------------------------------------------------------------------------
// POST /api/auth/login — Authenticate with FSP credentials
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { createFspClient } from "@/lib/fsp-client";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const isMock =
      process.env.FSP_ENVIRONMENT === "mock" || !process.env.FSP_ENVIRONMENT;

    if (isMock) {
      // Mock mode: accept any credentials
      const operators = [{ id: 1, name: "Demo Flight School" }];

      await createSession({
        userId: "dev-user-000",
        operatorId: operators[0].id,
        token: "mock-token",
        email: body.email,
        operators,
      });

      return NextResponse.json({ success: true, operators });
    }

    // Real mode: authenticate via FSP API
    const fspClient = createFspClient();
    const authResponse = await fspClient.authenticate(body.email, body.password);

    // The FSP auth response provides a token and user info.
    // For now, we create a session with operatorId=1 as a default.
    // The user can switch operators via the select-operator endpoint.
    const operators = [{ id: 1, name: "Flight School" }];

    await createSession({
      userId: authResponse.user.email,
      operatorId: operators[0].id,
      token: authResponse.token,
      email: authResponse.user.email,
      operators,
    });

    return NextResponse.json({ success: true, operators });
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof Error && error.message.includes("401")) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }
}
