// ---------------------------------------------------------------------------
// GET /api/proposals/:id — Get proposal detail with actions
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { getProposalById } from "@/lib/db/queries/proposals";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = getTenantFromRequest(request);
    const { id } = await params;

    const proposal = await getProposalById(db, tenant.operatorId, id);

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ proposal });
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
