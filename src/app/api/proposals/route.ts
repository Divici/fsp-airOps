// ---------------------------------------------------------------------------
// GET /api/proposals — List proposals with filtering and pagination
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inArray } from "drizzle-orm";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { listProposals } from "@/lib/db/queries/proposals";
import type { ProposalAction } from "@/lib/db/schema";
import { proposalActions } from "@/lib/db/schema";
import { proposalListQuerySchema } from "@/lib/types/api";
import { mapProposals } from "@/lib/api/mappers/proposal-mapper";
import { createFspClient } from "@/lib/fsp-client";

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

    // Fetch actions for all returned proposals in a single query
    const proposalIds = result.proposals.map((p) => p.id);
    const actions =
      proposalIds.length > 0
        ? await db
            .select()
            .from(proposalActions)
            .where(inArray(proposalActions.proposalId, proposalIds))
        : [];

    // Group actions by proposalId
    const actionsByProposal = new Map<string, ProposalAction[]>();
    for (const action of actions) {
      const list = actionsByProposal.get(action.proposalId) ?? [];
      list.push(action);
      actionsByProposal.set(action.proposalId, list);
    }

    // Attach actions to proposals
    const proposalsWithActions = result.proposals.map((p) => ({
      ...p,
      actions: actionsByProposal.get(p.id) ?? [],
    }));

    // Map to view shapes with FSP resource names
    const fspClient = createFspClient();
    const proposalViews = await mapProposals(
      proposalsWithActions,
      fspClient,
      tenant.operatorId
    );

    return NextResponse.json({
      proposals: proposalViews,
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
