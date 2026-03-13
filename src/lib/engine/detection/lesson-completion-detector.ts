// ---------------------------------------------------------------------------
// Lesson Completion Detector
// Detects when schedulable events transition from pending to completed
// by comparing snapshots of schedulable events.
// ---------------------------------------------------------------------------

import type { IFspClient, SchedulableEventsParams } from "@/lib/fsp-client/types";
import type { FspSchedulableEvent } from "@/lib/types/fsp";

export interface DetectedLessonCompletion {
  eventId: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  lessonId: string;
  lessonName: string;
  lessonOrder: number;
  courseId: string;
  courseName: string;
  /** Instructor IDs that were authorized for this lesson. */
  instructorIds: string[];
}

export interface LessonCompletionSnapshot {
  operatorId: number;
  /** Map of eventId -> FspSchedulableEvent for pending (not yet completed) events. */
  events: Map<string, FspSchedulableEvent>;
  capturedAt: Date;
}

export interface LessonCompletionDetectionResult {
  operatorId: number;
  completions: DetectedLessonCompletion[];
  currentSnapshot: LessonCompletionSnapshot;
}

/**
 * Create a snapshot from a list of schedulable events.
 */
export function createLessonSnapshot(
  operatorId: number,
  events: FspSchedulableEvent[],
): LessonCompletionSnapshot {
  const map = new Map<string, FspSchedulableEvent>();
  for (const evt of events) {
    map.set(evt.eventId, evt);
  }
  return {
    operatorId,
    events: map,
    capturedAt: new Date(),
  };
}

/**
 * Compare two snapshots to find events that were in `previous` but not in `current`.
 * Events that disappear from the schedulable list have been completed.
 */
export function compareLessonSnapshots(
  previous: LessonCompletionSnapshot,
  current: LessonCompletionSnapshot,
): DetectedLessonCompletion[] {
  const completions: DetectedLessonCompletion[] = [];

  for (const [eventId, evt] of previous.events) {
    if (!current.events.has(eventId)) {
      completions.push({
        eventId,
        enrollmentId: evt.enrollmentId,
        studentId: evt.studentId,
        studentName: `${evt.studentFirstName} ${evt.studentLastName}`,
        lessonId: evt.lessonId,
        lessonName: evt.lessonName,
        lessonOrder: evt.lessonOrder,
        courseId: evt.courseId,
        courseName: evt.courseName,
        instructorIds: evt.instructorIds,
      });
    }
  }

  return completions;
}

export class LessonCompletionDetector {
  constructor(private fspClient: IFspClient) {}

  /**
   * Fetch the current schedulable events and compare against a previous snapshot.
   * Events present in previous but absent in current are considered completed.
   */
  async detect(
    operatorId: number,
    previousSnapshot: LessonCompletionSnapshot,
    queryParams: SchedulableEventsParams,
  ): Promise<LessonCompletionDetectionResult> {
    const currentEvents = await this.fspClient.getSchedulableEvents(
      operatorId,
      queryParams,
    );

    const currentSnapshot = createLessonSnapshot(operatorId, currentEvents);
    const completions = compareLessonSnapshots(previousSnapshot, currentSnapshot);

    return {
      operatorId,
      completions,
      currentSnapshot,
    };
  }

  /**
   * Build a snapshot from the current schedulable events (useful for initial baseline).
   */
  async fetchSnapshot(
    operatorId: number,
    queryParams: SchedulableEventsParams,
  ): Promise<LessonCompletionSnapshot> {
    const events = await this.fspClient.getSchedulableEvents(
      operatorId,
      queryParams,
    );
    return createLessonSnapshot(operatorId, events);
  }
}
