import type { ProposalStatus, WorkflowType } from "./domain";

/**
 * A flattened view of a proposal for the UI layer.
 * Combines proposal fields with denormalized action data
 * so cards can render without joins or extra queries.
 */
export interface ProposalView {
  id: string;
  operatorId: number;
  workflowType: WorkflowType;
  status: ProposalStatus;
  priority: number;
  summary: string;
  rationale: string;
  studentNames: string[];
  locationName: string;
  proposedStartTime: string; // ISO string
  proposedEndTime: string; // ISO string
  actionCount: number;
  createdAt: string; // ISO string
  expiresAt: string | null;
}
