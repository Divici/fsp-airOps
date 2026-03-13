// ---------------------------------------------------------------------------
// ProposalBuilder — Maps WorkflowResult into persisted proposals
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { WorkflowType } from "@/lib/types/domain";
import type { WorkflowResult } from "@/lib/types/workflow";
import { createProposal } from "@/lib/db/queries/proposals";

/** Priority weights by workflow type (higher = more urgent). */
const WORKFLOW_PRIORITY: Record<WorkflowType, number> = {
  reschedule: 80,
  discovery_flight: 60,
  next_lesson: 40,
  waitlist: 20,
};

const DEFAULT_EXPIRY_HOURS = 24;

export class ProposalBuilder {
  constructor(private db: PostgresJsDatabase) {}

  /**
   * Build a proposal from a workflow result and persist it to the database.
   * Returns the new proposal ID.
   */
  async buildAndPersist(params: {
    operatorId: number;
    workflowType: WorkflowType;
    triggerId: string;
    result: WorkflowResult;
    rationale?: string;
    expiresInHours?: number;
  }): Promise<string> {
    const expiresInHours = params.expiresInHours ?? DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const priority = WORKFLOW_PRIORITY[params.workflowType] ?? 0;

    // Collect affected entity IDs from actions
    const studentIds = new Set<string>();
    const resourceIds = new Set<string>();

    for (const action of params.result.proposedActions) {
      studentIds.add(action.studentId);
      if (action.instructorId) resourceIds.add(action.instructorId);
      if (action.aircraftId) resourceIds.add(action.aircraftId);
    }

    const { proposalId } = await createProposal(this.db, {
      operatorId: params.operatorId,
      workflowType: params.workflowType,
      triggerId: params.triggerId,
      summary: params.result.summary,
      rationale: params.rationale ?? params.result.summary,
      priority,
      expiresAt,
      affectedStudentIds: [...studentIds],
      affectedResourceIds: [...resourceIds],
      actions: params.result.proposedActions.map((a) => ({
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
      })),
    });

    return proposalId;
  }
}
