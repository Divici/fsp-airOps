// ---------------------------------------------------------------------------
// Inactivity Outreach Workflow Types
// ---------------------------------------------------------------------------

/** Context shape stored in the trigger for inactivity outreach workflows. */
export interface InactivityOutreachContext {
  studentId: string;
  studentName: string;
  email: string;
  lastFlightDate: string | null;
  daysSinceLastFlight: number | null;
  enrollmentId?: string;
}
