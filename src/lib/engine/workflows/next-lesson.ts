// ---------------------------------------------------------------------------
// Next Lesson Workflow Handler
// Triggered by lesson completion — finds slots for the next training event.
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type { WorkflowHandler } from "../types";
import type {
  WorkflowContext,
  WorkflowResult,
  ProposalActionInput,
} from "@/lib/types/workflow";
import { FindATimeAdapter } from "../scheduling/find-a-time-adapter";
import { rankSlots } from "../scheduling/slot-ranker";
import { NextLessonResolver } from "../training/next-lesson-resolver";
import type { NextLessonWorkflowContext } from "./next-lesson.types";

export class NextLessonWorkflowHandler implements WorkflowHandler {
  type = "next_lesson" as const;

  constructor(private fspClient: IFspClient) {}

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const triggerContext =
      context.trigger.context as unknown as NextLessonWorkflowContext | null;

    if (!triggerContext) {
      return {
        proposedActions: [],
        summary: "No lesson completion context provided",
        rawData: { error: "missing_context" },
      };
    }

    // 1. Resolve the next lesson from enrollment
    const resolver = new NextLessonResolver(this.fspClient);
    const nextLesson = await resolver.getNextLesson(
      context.operatorId,
      triggerContext.studentId,
      triggerContext.enrollmentId,
    );

    if (!nextLesson) {
      return {
        proposedActions: [],
        summary: `No next lesson available for student ${triggerContext.studentId}`,
        rawData: {
          triggerContext,
          reason: "no_next_lesson",
        },
      };
    }

    const { nextEvent } = nextLesson;

    // 2. Build search window
    const searchStartDate = this.formatDate(new Date());
    const searchEndDate = this.formatDate(
      this.addDays(new Date(), context.settings.searchWindowDays),
    );

    // 3. Determine instructor preference for continuity
    const preferredInstructorId = triggerContext.completedInstructorId;
    const instructorIds = preferredInstructorId
      ? [preferredInstructorId, ...nextEvent.instructorIds.filter(
          (id) => id !== preferredInstructorId,
        )]
      : nextEvent.instructorIds.length > 0
        ? nextEvent.instructorIds
        : undefined;

    // 4. Find available slots via FSP
    const adapter = new FindATimeAdapter(this.fspClient);
    const slots = await adapter.findSlots({
      operatorId: context.operatorId,
      activityTypeId: nextEvent.activityTypeId,
      instructorIds,
      aircraftIds:
        nextEvent.aircraftIds.length > 0 ? nextEvent.aircraftIds : undefined,
      schedulingGroupIds:
        nextEvent.schedulingGroupIds.length > 0
          ? nextEvent.schedulingGroupIds
          : undefined,
      customerId: triggerContext.studentId,
      startDate: searchStartDate,
      endDate: searchEndDate,
      duration: nextEvent.durationTotal,
    });

    if (slots.length === 0) {
      return {
        proposedActions: [],
        summary: `No available slots found for ${nextEvent.lessonName}`,
        rawData: {
          triggerContext,
          nextEvent,
          slotsFound: 0,
          slotsRanked: 0,
        },
      };
    }

    // 5. Rank slots with instructor continuity bonus
    const ranked = rankSlots(slots, {
      preferSameInstructor: context.settings.preferSameInstructor,
      preferSameInstructorWeight: context.settings.preferSameInstructorWeight,
      preferredInstructorId,
      preferSameAircraft: context.settings.preferSameAircraft,
      preferSameAircraftWeight: context.settings.preferSameAircraftWeight,
    });

    // 6. Take top N from operator settings
    const topN = ranked.slice(0, context.settings.topNAlternatives);

    // 7. Map to proposal actions
    const proposedActions: ProposalActionInput[] = topN.map((slot, i) => ({
      rank: i + 1,
      actionType: "create_reservation" as const,
      startTime: slot.startTime,
      endTime: slot.endTime,
      locationId: slot.locationId,
      studentId: triggerContext.studentId,
      instructorId: slot.instructorId,
      aircraftId: slot.aircraftId,
      activityTypeId: nextEvent.activityTypeId,
      trainingContext: {
        enrollmentId: triggerContext.enrollmentId,
        lessonId: nextEvent.lessonId,
        lessonName: nextEvent.lessonName,
        lessonOrder: nextEvent.lessonOrder,
        courseName: nextEvent.courseName,
      },
    }));

    return {
      proposedActions,
      summary: `Found ${proposedActions.length} slots for ${nextEvent.lessonName}`,
      rawData: {
        triggerContext,
        nextEvent,
        slotsFound: slots.length,
        slotsRanked: ranked.length,
      },
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
