// ---------------------------------------------------------------------------
// Next Lesson Workflow Types
// ---------------------------------------------------------------------------

/** Context shape stored in the trigger for next-lesson workflows. */
export interface NextLessonWorkflowContext {
  studentId: string;
  enrollmentId: string;
  completedEventId: string;
  completedInstructorId?: string;
}
