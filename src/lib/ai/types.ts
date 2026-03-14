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

// ---------------------------------------------------------------------------
// Auto-Approval Types
// ---------------------------------------------------------------------------

export interface AutoApprovalContext {
  proposal: {
    id: string;
    operatorId: number;
    workflowType: string;
    summary: string;
    rationale: string;
    priority: number;
    actions: Array<{
      rank: number;
      actionType: string;
      startTime: Date;
      endTime: Date;
      locationId: number;
      studentId: string;
      instructorId?: string | null;
      aircraftId?: string | null;
      activityTypeId?: string | null;
    }>;
    affectedStudentIds?: string[] | null;
  };
  trigger: {
    id: string;
    type: string;
    context: Record<string, unknown> | null;
  };
  operatorSettings: {
    preferSameInstructor: boolean;
    preferSameAircraft: boolean;
    autoApprovalThreshold: number;
  };
  operatorId: number;
}

export interface AutoApprovalDecision {
  decision: "approve" | "defer";
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  mitigations: string[];
  toolCalls: ToolCallTrace[];
  method: "ai" | "deterministic";
}

export interface ToolCallTrace {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
}
