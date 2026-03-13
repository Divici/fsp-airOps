// ---------------------------------------------------------------------------
// Reschedule Workflow Handler
// Triggered by a cancellation — finds alternative slots and proposes them.
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
import type { CancelledReservationContext } from "./reschedule.types";

export class RescheduleWorkflowHandler implements WorkflowHandler {
  type = "reschedule" as const;

  constructor(private fspClient: IFspClient) {}

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const cancelledReservation =
      context.trigger.context as CancelledReservationContext;

    if (!cancelledReservation) {
      return {
        proposedActions: [],
        summary: "No cancelled reservation context provided",
        rawData: { error: "missing_context" },
      };
    }

    // Build search window from operator settings
    const searchStartDate = this.formatDate(new Date());
    const searchEndDate = this.formatDate(
      this.addDays(new Date(), context.settings.searchWindowDays),
    );

    // Compute duration from original reservation
    const originalStart = new Date(cancelledReservation.originalStart);
    const originalEnd = new Date(cancelledReservation.originalEnd);
    const durationMinutes = Math.round(
      (originalEnd.getTime() - originalStart.getTime()) / 60_000,
    );

    // Find available slots via FSP
    const adapter = new FindATimeAdapter(this.fspClient);
    const slots = await adapter.findSlots({
      operatorId: context.operatorId,
      activityTypeId: cancelledReservation.activityTypeId,
      instructorIds: cancelledReservation.instructorId
        ? [cancelledReservation.instructorId]
        : undefined,
      customerId: cancelledReservation.studentId,
      startDate: searchStartDate,
      endDate: searchEndDate,
      duration: durationMinutes,
    });

    if (slots.length === 0) {
      return {
        proposedActions: [],
        summary: `No alternative slots found for ${cancelledReservation.studentName}`,
        rawData: {
          cancelledReservation,
          slotsFound: 0,
          slotsRanked: 0,
        },
      };
    }

    // Rank slots using operator preferences
    const ranked = rankSlots(slots, {
      preferSameInstructor: context.settings.preferSameInstructor,
      preferSameInstructorWeight: context.settings.preferSameInstructorWeight,
      preferSameAircraft: context.settings.preferSameAircraft,
      preferSameAircraftWeight: context.settings.preferSameAircraftWeight,
      preferredInstructorId: cancelledReservation.instructorId,
      preferredAircraftId: cancelledReservation.aircraftId,
      originalStartHour: originalStart.getHours(),
    });

    // Take top N from operator settings
    const topN = ranked.slice(0, context.settings.topNAlternatives);

    // Map to proposal actions
    const proposedActions: ProposalActionInput[] = topN.map((slot, i) => ({
      rank: i + 1,
      actionType: "create_reservation" as const,
      startTime: slot.startTime,
      endTime: slot.endTime,
      locationId: slot.locationId,
      studentId: cancelledReservation.studentId,
      instructorId: slot.instructorId,
      aircraftId: slot.aircraftId,
      activityTypeId: cancelledReservation.activityTypeId,
    }));

    return {
      proposedActions,
      summary: `Found ${proposedActions.length} alternative slots for ${cancelledReservation.studentName}`,
      rawData: {
        cancelledReservation,
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
