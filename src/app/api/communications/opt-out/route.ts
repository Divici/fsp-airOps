// ---------------------------------------------------------------------------
// GET / POST / DELETE /api/communications/opt-out — manage student opt-outs
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import {
  optOut,
  optIn,
  getOptOutStatus,
} from "@/lib/db/queries/communication-opt-outs";

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);
    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId query parameter is required" },
        { status: 400 }
      );
    }

    const status = await getOptOutStatus(db, tenant.operatorId, studentId);

    return NextResponse.json({ studentId, optOuts: status });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);
    const body = await request.json();
    const { studentId, channel } = body;

    if (!studentId || !channel) {
      return NextResponse.json(
        { error: "studentId and channel are required" },
        { status: 400 }
      );
    }

    if (channel !== "email" && channel !== "sms") {
      return NextResponse.json(
        { error: 'channel must be "email" or "sms"' },
        { status: 400 }
      );
    }

    await optOut(db, tenant.operatorId, studentId, channel);

    return NextResponse.json({ success: true, action: "opted_out" });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);
    const body = await request.json();
    const { studentId, channel } = body;

    if (!studentId || !channel) {
      return NextResponse.json(
        { error: "studentId and channel are required" },
        { status: 400 }
      );
    }

    if (channel !== "email" && channel !== "sms") {
      return NextResponse.json(
        { error: 'channel must be "email" or "sms"' },
        { status: 400 }
      );
    }

    await optIn(db, tenant.operatorId, studentId, channel);

    return NextResponse.json({ success: true, action: "opted_in" });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
