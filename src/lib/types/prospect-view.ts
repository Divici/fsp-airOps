import type { ProspectStatus } from "./domain";

/**
 * A flattened view of a prospect request for the UI layer.
 * Maps to the prospect_requests DB table with minimal joins.
 */
export interface ProspectView {
  id: string;
  operatorId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: ProspectStatus;
  preferredDate: string | null; // ISO date string
  preferredTimeOfDay: string | null; // e.g. "morning", "afternoon", "evening"
  createdAt: string; // ISO string
  linkedProposalId: string | null;
}
