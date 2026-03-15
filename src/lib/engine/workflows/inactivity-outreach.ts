// ---------------------------------------------------------------------------
// Inactivity Outreach Workflow Handler
// Triggered when a student has not flown recently — finds slots, ranks them
// with AI, and generates a personalized outreach message.
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
import { rankSlotsWithAI, type StudentHistory } from "@/lib/ai/slot-ranker";
import { generateOutreachMessage } from "@/lib/ai/outreach-message-generator";
import type { InactivityOutreachContext } from "./inactivity-outreach.types";

export class InactivityOutreachWorkflowHandler implements WorkflowHandler {
  // Using "next_lesson" as the closest existing WorkflowType — inactivity
  // outreach is effectively proposing the next lesson for an inactive student.
  type = "next_lesson" as const;

  constructor(private fspClient: IFspClient) {}

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const triggerContext =
      context.trigger.context as unknown as InactivityOutreachContext | null;

    if (!triggerContext) {
      return {
        proposedActions: [],
        summary: "No inactivity outreach context provided",
        rawData: { error: "missing_context" },
      };
    }

    // 1. Build search window
    const searchStartDate = this.formatDate(new Date());
    const searchEndDate = this.formatDate(
      this.addDays(new Date(), context.settings.searchWindowDays),
    );

    // 2. Find available slots via FSP
    const adapter = new FindATimeAdapter(this.fspClient);
    const slots = await adapter.findSlots({
      operatorId: context.operatorId,
      activityTypeId: triggerContext.nextLessonType ?? "flight_training",
      instructorIds: triggerContext.lastInstructorId
        ? [triggerContext.lastInstructorId]
        : undefined,
      customerId: triggerContext.studentId,
      startDate: searchStartDate,
      endDate: searchEndDate,
      duration: 60, // Default 1-hour lesson
    });

    if (slots.length === 0) {
      return {
        proposedActions: [],
        summary: `No available slots found for inactive student ${triggerContext.studentName}`,
        rawData: {
          triggerContext,
          slotsFound: 0,
          slotsRanked: 0,
        },
      };
    }

    // 3. Deterministic ranking first
    let ranked = rankSlots(slots, {
      preferSameInstructor: context.settings.preferSameInstructor,
      preferSameInstructorWeight: context.settings.preferSameInstructorWeight,
      preferredInstructorId: triggerContext.lastInstructorId,
      preferSameAircraft: context.settings.preferSameAircraft,
      preferSameAircraftWeight: context.settings.preferSameAircraftWeight,
    });

    // 4. AI re-ranking (if OpenAI key is configured)
    const studentHistory: StudentHistory = {
      studentId: triggerContext.studentId,
      studentName: triggerContext.studentName,
      recentBookings: triggerContext.recentBookings ?? [],
      preferredInstructorId: triggerContext.lastInstructorId,
      daysSinceLastFlight: triggerContext.daysSinceLastFlight,
    };

    ranked = await rankSlotsWithAI(ranked, studentHistory);

    // 5. Take top N from operator settings
    const topN = ranked.slice(0, context.settings.topNAlternatives);

    // 6. Map to proposal actions
    const proposedActions: ProposalActionInput[] = topN.map((slot, i) => ({
      rank: i + 1,
      actionType: "create_reservation" as const,
      startTime: slot.startTime,
      endTime: slot.endTime,
      locationId: slot.locationId,
      studentId: triggerContext.studentId,
      instructorId: slot.instructorId,
      aircraftId: slot.aircraftId,
    }));

    // 7. Generate personalized outreach message for the top slot
    const topSlot = topN[0];
    const outreachMessage = await generateOutreachMessage({
      studentName: triggerContext.studentName,
      daysSinceLastFlight: triggerContext.daysSinceLastFlight,
      nextLessonType: triggerContext.nextLessonType ?? "Training Flight",
      proposedDate: topSlot.startTime.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      proposedTime: topSlot.startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      instructorName: topSlot.instructorId ?? "an available instructor",
      operatorName: `Operator ${context.operatorId}`,
    });

    return {
      proposedActions,
      summary: `Found ${proposedActions.length} slots for inactive student ${triggerContext.studentName} (${triggerContext.daysSinceLastFlight} days since last flight)`,
      rawData: {
        triggerContext,
        slotsFound: slots.length,
        slotsRanked: ranked.length,
        outreachMessage,
        aiRankingApplied: !!process.env.OPENAI_API_KEY,
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
