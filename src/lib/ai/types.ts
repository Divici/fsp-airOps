// ---------------------------------------------------------------------------
// AI Service Types
// ---------------------------------------------------------------------------

import type { WorkflowType } from "@/lib/types/domain";
import type { ProposalActionInput } from "@/lib/types/workflow";

/** Structured rationale returned by the AI assembler. */
export interface ProposalRationale {
  /** One-sentence summary of the proposal. */
  summary: string;
  /** 2-4 sentences explaining why these options were selected. */
  rationale: string;
  /** Per-action explanation, aligned by index with the proposed actions. */
  actionExplanations: string[];
}

/** Context fed into the AI prompt for rationale generation. */
export interface RationaleContext {
  workflowType: WorkflowType;
  triggerContext: Record<string, unknown>;
  proposedActions: ProposalActionInput[];
  operatorSettings: Record<string, unknown>;
  additionalContext?: Record<string, unknown>;
}
