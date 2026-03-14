// ---------------------------------------------------------------------------
// GET /api/prospects — List prospect requests with filtering and pagination
// POST /api/prospects — Create a new prospect request
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import {
  createProspectRequest,
  listProspectRequests,
} from "@/lib/db/queries/prospects";
import { prospectRequests } from "@/lib/db/schema";
import {
  createProspectRequestSchema,
  listProspectsQuerySchema,
} from "@/lib/types/api";
import { createOrchestrator } from "@/lib/engine";
import { createFspClient } from "@/lib/fsp-client";
import { TriggerService } from "@/lib/engine/trigger-service";
import { updateProspectStatus } from "@/lib/db/queries/prospects";
import { mapProspects } from "@/lib/api/mappers/prospect-mapper";

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
      prospects: mapProspects(result.prospects),
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

    // Auto-trigger: create and dispatch a discovery_request trigger
    const fspClient = createFspClient();
    const orchestrator = createOrchestrator(db, fspClient);
    const triggerService = new TriggerService(db, orchestrator);

    const triggerResult = await triggerService.createAndDispatch({
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

    // Advance prospect status: new → processing → proposed (if proposal generated)
    const proposalId = triggerResult.result?.proposalId;
    await updateProspectStatus(db, parsed.data.operatorId, prospect.id, "processing");
    if (proposalId) {
      await updateProspectStatus(db, parsed.data.operatorId, prospect.id, "proposed");
      await db
        .update(prospectRequests)
        .set({ linkedProposalId: proposalId })
        .where(eq(prospectRequests.id, prospect.id));
    }

    return NextResponse.json({ prospect }, { status: 201 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
