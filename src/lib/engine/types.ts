// ---------------------------------------------------------------------------
// Engine Types — Shared interfaces for the orchestration engine
// ---------------------------------------------------------------------------

import type { WorkflowType } from "@/lib/types/domain";
import type { WorkflowContext, WorkflowResult } from "@/lib/types/workflow";

/** Each workflow implements this interface. */
export interface WorkflowHandler {
  type: WorkflowType;
  execute(context: WorkflowContext): Promise<WorkflowResult>;
}

/** Pipeline step result. */
export interface PipelineStepResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Full engine execution result. */
export interface EngineExecutionResult {
  triggerId: string;
  proposalId?: string;
  success: boolean;
  error?: string;
  /** Audit event IDs generated during execution. */
  auditTrail: string[];
}
