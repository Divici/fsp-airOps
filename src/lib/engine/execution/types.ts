// ---------------------------------------------------------------------------
// Execution Pipeline Types
// ---------------------------------------------------------------------------

export interface ExecutionResult {
  actionId: string;
  success: boolean;
  fspReservationId?: string;
  error?: string;
}

export interface ProposalExecutionResult {
  proposalId: string;
  /** true only if ALL actions succeeded */
  success: boolean;
  results: ExecutionResult[];
  errors: string[];
}
