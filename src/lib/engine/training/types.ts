// ---------------------------------------------------------------------------
// Training Module Types
// ---------------------------------------------------------------------------

import type { FspSchedulableEvent } from "@/lib/types/fsp";

/** Context for the next lesson to be scheduled. */
export interface NextLessonContext {
  studentId: string;
  enrollmentId: string;
  nextEvent: FspSchedulableEvent;
  /** Prefer the same instructor as previous lessons when finding slots. */
  preferInstructorContinuity: boolean;
}

/** Context extracted from a lesson completion trigger. */
export interface LessonCompletionTriggerContext {
  studentId: string;
  enrollmentId: string;
  completedEventId: string;
  /** The instructor who taught the completed lesson, for continuity. */
  completedInstructorId?: string;
}
