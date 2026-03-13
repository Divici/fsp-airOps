// ---------------------------------------------------------------------------
// GET /api/proposals — List proposals with filtering and pagination
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { listProposals } from "@/lib/db/queries/proposals";
import { proposalListQuerySchema } from "@/lib/types/api";

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const url = new URL(request.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = proposalListQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { status, workflowType, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const result = await listProposals(db, {
      operatorId: tenant.operatorId,
      status,
      workflowType,
      limit,
      offset,
    });

    return NextResponse.json({
      proposals: result.proposals,
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
