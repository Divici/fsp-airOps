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
import { mapProposalDetail } from "@/lib/api/mappers/proposal-mapper";
import { createFspClient } from "@/lib/fsp-client";

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

    const fspClient = createFspClient();
    const proposalView = await mapProposalDetail(
      proposal,
      fspClient,
      tenant.operatorId
    );

    return NextResponse.json({ proposal: proposalView });
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
