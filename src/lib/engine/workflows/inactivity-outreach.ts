// ---------------------------------------------------------------------------
// Inactivity Outreach Workflow Handler
// Triggered by inactivity detection — finds the student's next lesson and
// proposes available slots, prioritizing soonest + instructor continuity.
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
import type { InactivityOutreachContext } from "./inactivity-outreach.types";

export class InactivityOutreachWorkflowHandler implements WorkflowHandler {
  type = "inactivity_outreach" as const;

  constructor(private fspClient: IFspClient) {}

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const triggerContext =
      context.trigger.context as unknown as InactivityOutreachContext | null;

    if (!triggerContext) {
      return {
        proposedActions: [],
        summary: "No inactivity context provided",
        rawData: { error: "missing_context" },
      };
    }

    // 1. Resolve the next lesson from the student's enrollment
    const resolver = new NextLessonResolver(this.fspClient);

    // Try to find any active enrollment for this student
    const enrollments = await this.fspClient.getEnrollments(
      context.operatorId,
      triggerContext.studentId,
    );

    const activeEnrollment = enrollments.find(
      (e) => e.status === "Active" || e.status === "active",
    );

    if (!activeEnrollment) {
      return {
        proposedActions: [],
        summary: `No active enrollment found for ${triggerContext.studentName}`,
        rawData: {
          triggerContext,
          reason: "no_active_enrollment",
        },
      };
    }

    const nextLesson = await resolver.getNextLesson(
      context.operatorId,
      triggerContext.studentId,
      activeEnrollment.enrollmentId,
    );

    if (!nextLesson) {
      return {
        proposedActions: [],
        summary: `No next lesson available for ${triggerContext.studentName}`,
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

    // 3. Find available slots via FSP
    const adapter = new FindATimeAdapter(this.fspClient);
    const slots = await adapter.findSlots({
      operatorId: context.operatorId,
      activityTypeId: nextEvent.activityTypeId,
      instructorIds:
        nextEvent.instructorIds.length > 0
          ? nextEvent.instructorIds
          : undefined,
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
        summary: `No available slots found for ${triggerContext.studentName}'s next lesson (${nextEvent.lessonName})`,
        rawData: {
          triggerContext,
          nextEvent,
          slotsFound: 0,
        },
      };
    }

    // 4. Deterministic ranking: soonest available + instructor continuity
    //    (AI ranker will be added in Phase C)
    const ranked = rankSlots(slots, {
      preferSameInstructor: context.settings.preferSameInstructor,
      preferSameInstructorWeight: context.settings.preferSameInstructorWeight,
      preferSameAircraft: context.settings.preferSameAircraft,
      preferSameAircraftWeight: context.settings.preferSameAircraftWeight,
    });

    // 5. Take top N from operator settings
    const topN = ranked.slice(0, context.settings.topNAlternatives);

    // 6. Build the inactivity-specific rationale
    const daysLabel = triggerContext.daysSinceLastFlight
      ? `${triggerContext.daysSinceLastFlight} days`
      : "an extended period";
    const topSlot = topN[0];
    const slotDate = topSlot.startTime.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const slotTime = topSlot.startTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const rationale =
      `${triggerContext.studentName} has not flown in ${daysLabel}. ` +
      `Their next lesson is ${nextEvent.courseName} — ${nextEvent.lessonName}. ` +
      `A slot is available on ${slotDate} at ${slotTime}` +
      (topSlot.instructorId ? ` with instructor ${topSlot.instructorId}` : "") +
      `.`;

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
        enrollmentId: activeEnrollment.enrollmentId,
        lessonId: nextEvent.lessonId,
        lessonName: nextEvent.lessonName,
        lessonOrder: nextEvent.lessonOrder,
        courseName: nextEvent.courseName,
        inactivityOutreach: true,
        daysSinceLastFlight: triggerContext.daysSinceLastFlight,
      },
      explanation: i === 0 ? rationale : undefined,
    }));

    return {
      proposedActions,
      summary: rationale,
      rawData: {
        triggerContext,
        nextEvent,
        enrollmentId: activeEnrollment.enrollmentId,
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
