// ---------------------------------------------------------------------------
// POST /api/proposals/batch/decline — Batch-decline multiple proposals
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import {
  getProposalById,
  updateProposalStatus,
} from "@/lib/db/queries/proposals";
import { createApprovalDecision } from "@/lib/db/queries/approvals";
import { assertTransition } from "@/lib/engine/proposal-lifecycle";
import { AuditService } from "@/lib/engine/audit";
import { batchDeclineSchema } from "@/lib/types/api";

interface BatchResult {
  proposalId: string;
  success: boolean;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = batchDeclineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { proposalIds, reason } = parsed.data;
    const audit = new AuditService(db);
    const results: BatchResult[] = [];

    for (const proposalId of proposalIds) {
      try {
        // Fetch proposal
        const proposal = await getProposalById(
          db,
          tenant.operatorId,
          proposalId
        );
        if (!proposal) {
          results.push({
            proposalId,
            success: false,
            error: "Proposal not found",
          });
          continue;
        }

        // Validate state transition
        assertTransition(proposal.status!, "declined");

        // Update proposal status
        await updateProposalStatus(
          db,
          tenant.operatorId,
          proposalId,
          "declined"
        );

        // Create approval decision record
        await createApprovalDecision(db, {
          proposalId,
          operatorId: tenant.operatorId,
          decidedByUserId: tenant.userId,
          decision: "declined",
          notes: reason,
        });

        // Log audit event
        await audit.logProposalDeclined(
          tenant.operatorId,
          proposalId,
          tenant.userId,
          reason
        );

        results.push({ proposalId, success: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        results.push({ proposalId, success: false, error: message });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Batch decline API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
