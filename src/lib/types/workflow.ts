// ---------------------------------------------------------------------------
// Workflow Context Types
// Used by the orchestration engine to plan and execute scheduling workflows.
// ---------------------------------------------------------------------------

import type { OperatorSettings, SchedulingTrigger } from "@/lib/db/schema";
import type { ProposalActionType } from "./domain";

/** Top-level context passed into every workflow run. */
export interface WorkflowContext {
  operatorId: number;
  trigger: SchedulingTrigger;
  settings: OperatorSettings;
}

/** Input shape for creating a new proposal action (before DB insert). */
export interface ProposalActionInput {
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
}

/** What a workflow run returns to the orchestrator. */
export interface WorkflowResult {
  proposedActions: ProposalActionInput[];
  summary: string;
  rawData: unknown;
}

/** A single candidate slot surfaced by the slot-finder. */
export interface SlotOption {
  startTime: Date;
  endTime: Date;
  instructorId?: string;
  aircraftId?: string;
  locationId: number;
  /** Higher is better. */
  score: number;
}
