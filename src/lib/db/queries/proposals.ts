// ---------------------------------------------------------------------------
// Proposal CRUD — Tenant-scoped queries for proposals and proposal actions
// ---------------------------------------------------------------------------

import { eq, and, sql, lte, inArray, gte } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { proposals, proposalActions } from "@/lib/db/schema";
import type { Proposal, ProposalAction } from "@/lib/db/schema";
import type {
  ProposalStatus,
  ProposalActionType,
  ValidationStatus,
  ExecutionStatus,
  WorkflowType,
} from "@/lib/types/domain";
import { withTenant, withTenantAnd } from "./base";
import { assertTransition } from "@/lib/engine/proposal-lifecycle";

/** A proposal with its child actions attached. */
export interface ProposalWithActions extends Proposal {
  actions: ProposalAction[];
}

/** Parameters for creating a proposal with actions. */
export interface CreateProposalParams {
  operatorId: number;
  workflowType: WorkflowType;
  triggerId: string;
  summary: string;
  rationale: string;
  priority?: number;
  expiresAt?: Date;
  affectedStudentIds?: string[];
  affectedReservationIds?: string[];
  affectedResourceIds?: string[];
  actions: Array<{
    rank: number;
    actionType: ProposalActionType;
    startTime: Date;
    endTime: Date;
    locationId: number;
    studentId: string;
    instructorId?: string;
    aircraftId?: string;
    activityTypeId?: string;
    trainingContext?: Record<string, unknown>;
    explanation?: string;
  }>;
}

/**
 * Create a proposal with its actions in a single transaction.
 */
export async function createProposal(
  db: PostgresJsDatabase,
  params: CreateProposalParams
): Promise<{ proposalId: string; actionIds: string[] }> {
  return db.transaction(async (tx) => {
    const [proposal] = await tx
      .insert(proposals)
      .values({
        operatorId: params.operatorId,
        workflowType: params.workflowType,
        triggerId: params.triggerId,
        status: "pending",
        summary: params.summary,
        rationale: params.rationale,
        priority: params.priority ?? 0,
        expiresAt: params.expiresAt,
        affectedStudentIds: params.affectedStudentIds,
        affectedReservationIds: params.affectedReservationIds,
        affectedResourceIds: params.affectedResourceIds,
      })
      .returning();

    const actionIds: string[] = [];

    if (params.actions.length > 0) {
      const insertedActions = await tx
        .insert(proposalActions)
        .values(
          params.actions.map((a) => ({
            proposalId: proposal.id,
            operatorId: params.operatorId,
            rank: a.rank,
            actionType: a.actionType,
            startTime: a.startTime,
            endTime: a.endTime,
            locationId: a.locationId,
            studentId: a.studentId,
            instructorId: a.instructorId,
            aircraftId: a.aircraftId,
            activityTypeId: a.activityTypeId,
            trainingContext: a.trainingContext,
            explanation: a.explanation,
          }))
        )
        .returning();

      for (const action of insertedActions) {
        actionIds.push(action.id);
      }
    }

    return { proposalId: proposal.id, actionIds };
  });
}

/**
 * Get a proposal by ID with its actions, scoped to the given operator.
 */
export async function getProposalById(
  db: PostgresJsDatabase,
  operatorId: number,
  proposalId: string
): Promise<ProposalWithActions | null> {
  const rows = await db
    .select()
    .from(proposals)
    .where(
      withTenantAnd(proposals, operatorId, eq(proposals.id, proposalId))
    )
    .limit(1);

  if (rows.length === 0) return null;

  const actions = await db
    .select()
    .from(proposalActions)
    .where(
      withTenantAnd(
        proposalActions,
        operatorId,
        eq(proposalActions.proposalId, proposalId)
      )
    )
    .orderBy(proposalActions.rank);

  return { ...rows[0], actions };
}

/** Parameters for listing proposals. */
export interface ListProposalsParams {
  operatorId: number;
  status?: ProposalStatus | ProposalStatus[];
  workflowType?: WorkflowType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * List proposals with optional filters, scoped to the given operator.
 */
export async function listProposals(
  db: PostgresJsDatabase,
  params: ListProposalsParams
): Promise<{ proposals: Proposal[]; total: number }> {
  const conditions = [withTenant(proposals, params.operatorId)];

  if (params.status !== undefined) {
    const statuses = Array.isArray(params.status)
      ? params.status
      : [params.status];
    conditions.push(inArray(proposals.status, statuses));
  }

  if (params.workflowType !== undefined) {
    conditions.push(eq(proposals.workflowType, params.workflowType));
  }

  if (params.startDate !== undefined) {
    conditions.push(gte(proposals.createdAt, params.startDate));
  }

  if (params.endDate !== undefined) {
    conditions.push(lte(proposals.createdAt, params.endDate));
  }

  const whereClause = and(...conditions)!;

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposals)
      .where(whereClause),
    db
      .select()
      .from(proposals)
      .where(whereClause)
      .orderBy(sql`${proposals.createdAt} desc`)
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
  ]);

  return {
    proposals: rows,
    total: countResult[0]?.count ?? 0,
  };
}

/**
 * Update a proposal's status with transition validation.
 */
export async function updateProposalStatus(
  db: PostgresJsDatabase,
  operatorId: number,
  proposalId: string,
  status: ProposalStatus
): Promise<void> {
  const existing = await db
    .select({ status: proposals.status })
    .from(proposals)
    .where(
      withTenantAnd(proposals, operatorId, eq(proposals.id, proposalId))
    )
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  assertTransition(existing[0].status!, status);

  await db
    .update(proposals)
    .set({ status, updatedAt: new Date() })
    .where(
      withTenantAnd(proposals, operatorId, eq(proposals.id, proposalId))
    );
}

/**
 * Update execution-related fields on a proposal action.
 */
export async function updateActionExecutionStatus(
  db: PostgresJsDatabase,
  operatorId: number,
  actionId: string,
  params: {
    validationStatus?: ValidationStatus;
    executionStatus?: ExecutionStatus;
    executionError?: string;
    fspReservationId?: string;
  }
): Promise<void> {
  const setValues: Record<string, unknown> = { updatedAt: new Date() };

  if (params.validationStatus !== undefined)
    setValues.validationStatus = params.validationStatus;
  if (params.executionStatus !== undefined)
    setValues.executionStatus = params.executionStatus;
  if (params.executionError !== undefined)
    setValues.executionError = params.executionError;
  if (params.fspReservationId !== undefined)
    setValues.fspReservationId = params.fspReservationId;

  await db
    .update(proposalActions)
    .set(setValues)
    .where(
      withTenantAnd(
        proposalActions,
        operatorId,
        eq(proposalActions.id, actionId)
      )
    );
}

/**
 * Expire stale proposals whose expiresAt has passed and are still pending.
 * Returns the number of proposals expired.
 */
export async function expireStaleProposals(
  db: PostgresJsDatabase,
  operatorId: number
): Promise<number> {
  const now = new Date();

  const result = await db
    .update(proposals)
    .set({ status: "expired" as const, updatedAt: now })
    .where(
      withTenantAnd(
        proposals,
        operatorId,
        eq(proposals.status, "pending"),
        lte(proposals.expiresAt, now)
      )
    )
    .returning({ id: proposals.id });

  return result.length;
}
