// ---------------------------------------------------------------------------
// POST /api/proposals/:id/approve — Approve a pending proposal
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
import { approveProposalSchema } from "@/lib/types/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = getTenantFromRequest(request);
    const { id } = await params;

    // Parse optional body (notes)
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // No body is acceptable
    }

    const parsed = approveProposalSchema.safeParse({
      proposalId: id,
      decidedByUserId: tenant.userId,
      ...body,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Verify proposal exists and is accessible
    const proposal = await getProposalById(db, tenant.operatorId, id);
    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    // Validate state transition
    assertTransition(proposal.status!, "approved");

    // Update proposal status
    await updateProposalStatus(db, tenant.operatorId, id, "approved");

    // Create approval decision record
    const approvalId = await createApprovalDecision(db, {
      proposalId: id,
      operatorId: tenant.operatorId,
      decidedByUserId: tenant.userId,
      decision: "approved",
      notes: parsed.data.notes,
    });

    // Log audit event
    const audit = new AuditService(db);
    await audit.logProposalApproved(tenant.operatorId, id, tenant.userId);

    return NextResponse.json({
      success: true,
      approvalId,
      proposalId: id,
      status: "approved",
    });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("Invalid proposal status transition")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
