// ---------------------------------------------------------------------------
// Approval Decision CRUD — Tenant-scoped queries for approval decisions
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { approvalDecisions } from "@/lib/db/schema";

export interface CreateApprovalDecisionParams {
  proposalId: string;
  operatorId: number;
  decidedByUserId: string;
  decision: "approved" | "declined";
  notes?: string;
}

/**
 * Create an approval decision record for a proposal.
 * Returns the ID of the created approval decision.
 */
export async function createApprovalDecision(
  db: PostgresJsDatabase,
  params: CreateApprovalDecisionParams
): Promise<string> {
  const [row] = await db
    .insert(approvalDecisions)
    .values({
      proposalId: params.proposalId,
      operatorId: params.operatorId,
      decidedByUserId: params.decidedByUserId,
      decision: params.decision,
      notes: params.notes,
      decidedAt: new Date(),
    })
    .returning({ id: approvalDecisions.id });

  return row.id;
}
