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
import { eq } from "drizzle-orm";
import { createFspClient } from "@/lib/fsp-client";
import { ReservationExecutor } from "@/lib/engine/execution/reservation-executor";
import { schedulingTriggers } from "@/lib/db/schema";
import { updateProspectStatus } from "@/lib/db/queries/prospects";
import { sendApprovalNotification } from "@/lib/comms";

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

    // Execute the approved proposal (validate-then-create reservations)
    try {
      const fspClient = createFspClient();
      const executor = new ReservationExecutor(db, fspClient, audit);
      const executionResult = await executor.executeProposal(tenant.operatorId, id);

      // If this is a discovery_flight proposal, update the linked prospect status
      if (proposal.workflowType === "discovery_flight" && proposal.triggerId) {
        try {
          const trigger = await db
            .select()
            .from(schedulingTriggers)
            .where(eq(schedulingTriggers.id, proposal.triggerId))
            .limit(1);

          const prospectId = trigger[0]?.sourceEntityId;
          if (prospectId && trigger[0]?.sourceEntityType === "prospect_request") {
            await updateProspectStatus(db, tenant.operatorId, prospectId, "approved");
            if (executionResult.success) {
              await updateProspectStatus(db, tenant.operatorId, prospectId, "booked");
            }
          }
        } catch {
          // Non-critical — don't fail the approval if prospect update fails
        }
      }

      // Resolve student contact info for notifications
      let studentEmail: string | undefined;
      let studentName: string | undefined;
      try {
        const fsp = createFspClient();
        const users = await fsp.getUsers(tenant.operatorId);
        const studentId = proposal.affectedStudentIds?.[0];
        if (studentId) {
          const student = users.find((u) => u.id === studentId);
          if (student) {
            studentEmail = student.email;
            studentName = student.fullName || `${student.firstName} ${student.lastName}`;
          }
        }
      } catch {
        // Non-critical — proceed without contact info
      }

      // Fire-and-forget notification — don't block the response
      sendApprovalNotification({
        db,
        operatorId: tenant.operatorId,
        proposal,
        executionSuccess: executionResult.success,
        studentEmail,
        studentName,
      }).catch(() => {
        // Swallowed intentionally — notification failure is non-critical
      });

      return NextResponse.json({
        success: true,
        approvalId,
        proposalId: id,
        status: executionResult.success ? "executed" : "failed",
        execution: {
          success: executionResult.success,
          actionsExecuted: executionResult.results.filter((r) => r.success).length,
          actionsFailed: executionResult.results.filter((r) => !r.success).length,
          errors: executionResult.errors,
        },
      });
    } catch (executionError) {
      // Execution failure should not cause a 500 — proposal stays "approved"
      const message =
        executionError instanceof Error ? executionError.message : "Unknown execution error";
      return NextResponse.json({
        success: true,
        approvalId,
        proposalId: id,
        status: "approved",
        execution: {
          success: false,
          error: message,
        },
      });
    }
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
