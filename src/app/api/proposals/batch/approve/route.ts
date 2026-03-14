// ---------------------------------------------------------------------------
// POST /api/proposals/batch/approve — Batch-approve multiple proposals
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
import { batchApproveSchema } from "@/lib/types/api";
import { createFspClient } from "@/lib/fsp-client";
import { ReservationExecutor } from "@/lib/engine/execution/reservation-executor";

interface BatchResult {
  proposalId: string;
  success: boolean;
  error?: string;
  execution?: {
    success: boolean;
    actionsExecuted?: number;
    actionsFailed?: number;
    errors?: string[];
    error?: string;
  };
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

    const parsed = batchApproveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { proposalIds, notes } = parsed.data;
    const audit = new AuditService(db);
    const fspClient = createFspClient();
    const executor = new ReservationExecutor(db, fspClient, audit);
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
        assertTransition(proposal.status!, "approved");

        // Update proposal status
        await updateProposalStatus(
          db,
          tenant.operatorId,
          proposalId,
          "approved"
        );

        // Create approval decision record
        await createApprovalDecision(db, {
          proposalId,
          operatorId: tenant.operatorId,
          decidedByUserId: tenant.userId,
          decision: "approved",
          notes,
        });

        // Log audit event
        await audit.logProposalApproved(
          tenant.operatorId,
          proposalId,
          tenant.userId
        );

        // Execute the approved proposal (validate-then-create reservations)
        try {
          const executionResult = await executor.executeProposal(
            tenant.operatorId,
            proposalId
          );
          results.push({
            proposalId,
            success: true,
            execution: {
              success: executionResult.success,
              actionsExecuted: executionResult.results.filter((r) => r.success).length,
              actionsFailed: executionResult.results.filter((r) => !r.success).length,
              errors: executionResult.errors,
            },
          });
        } catch (executionError) {
          // Execution failure should not fail the approval — proposal stays "approved"
          const message =
            executionError instanceof Error ? executionError.message : "Unknown execution error";
          results.push({
            proposalId,
            success: true,
            execution: {
              success: false,
              error: message,
            },
          });
        }
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
    console.error("Batch approve API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
