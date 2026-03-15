// ---------------------------------------------------------------------------
// Inactivity Outreach Workflow — Trigger context types
// ---------------------------------------------------------------------------

export interface InactivityOutreachContext {
  studentId: string;
  studentName: string;
  daysSinceLastFlight: number;
  lastInstructorId?: string;
  enrollmentId?: string;
  nextLessonType?: string;
  /** Recent booking patterns for AI slot ranking. */
  recentBookings?: Array<{
    dayOfWeek: string;
    timeOfDay: string;
    instructorId: string;
  }>;
}
