// ---------------------------------------------------------------------------
// GET /api/prospects — List prospect requests with filtering and pagination
// POST /api/prospects — Create a new prospect request
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import {
  createProspectRequest,
  listProspectRequests,
} from "@/lib/db/queries/prospects";
import {
  createProspectRequestSchema,
  listProspectsQuerySchema,
} from "@/lib/types/api";
import { createTrigger } from "@/lib/db/queries/triggers";

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const url = new URL(request.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = listProspectsQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { status, startDate, endDate, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const result = await listProspectRequests(db, {
      operatorId: tenant.operatorId,
      status,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json({
      prospects: result.prospects,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
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
    const body = await request.json();
    const parsed = createProspectRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const prospect = await createProspectRequest(db, parsed.data);

    // Auto-trigger: create a discovery_request trigger for the new prospect
    await createTrigger(db, {
      operatorId: parsed.data.operatorId,
      type: "discovery_request",
      sourceEntityId: prospect.id,
      sourceEntityType: "prospect_request",
      context: {
        prospectId: prospect.id,
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        email: prospect.email,
        preferredLocationId: prospect.preferredLocationId,
        preferredDateStart: prospect.preferredDateStart,
        preferredDateEnd: prospect.preferredDateEnd,
        preferredTimeWindows: prospect.preferredTimeWindows,
      },
    });

    return NextResponse.json({ prospect }, { status: 201 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
