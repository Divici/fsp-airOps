// ---------------------------------------------------------------------------
// Proposal Lifecycle — Status transition validation
// ---------------------------------------------------------------------------

import type { ProposalStatus } from "@/lib/types/domain";

/** Valid status transitions for proposals. */
const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["pending"],
  pending: ["approved", "declined", "expired"],
  approved: ["executed", "failed"],
  declined: [],
  expired: [],
  executed: [],
  failed: ["pending"], // allow retry
};

/**
 * Check whether transitioning from one status to another is valid.
 */
export function validateTransition(
  from: ProposalStatus,
  to: ProposalStatus
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed !== undefined && allowed.includes(to);
}

/**
 * Assert that a status transition is valid; throws if not.
 */
export function assertTransition(
  from: ProposalStatus,
  to: ProposalStatus
): void {
  if (!validateTransition(from, to)) {
    throw new Error(
      `Invalid proposal status transition: '${from}' -> '${to}'`
    );
  }
}
