// ---------------------------------------------------------------------------
// Weather Disruption Workflow Handler
// Triggered by weather below minimums — finds alternative slots after weather
// clears and proposes reschedule options.
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
import type { WeatherDisruptionContext } from "./weather-disruption.types";

export class WeatherDisruptionWorkflowHandler implements WorkflowHandler {
  type = "weather_disruption" as const;

  constructor(private fspClient: IFspClient) {}

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const weatherContext =
      context.trigger.context as WeatherDisruptionContext | null;

    if (!weatherContext) {
      return {
        proposedActions: [],
        summary: "No weather disruption context provided",
        rawData: { error: "missing_context" },
      };
    }

    // Search for slots after weather clears, same day + next day
    const weatherClearsAt = new Date(weatherContext.weatherClearsAt);
    const searchStartDate = this.formatDate(weatherClearsAt);
    const searchEndDate = this.formatDate(this.addDays(weatherClearsAt, 1));

    // Compute duration from original reservation
    const originalStart = new Date(weatherContext.originalStart);
    const originalEnd = new Date(weatherContext.originalEnd);
    const durationMinutes = Math.round(
      (originalEnd.getTime() - originalStart.getTime()) / 60_000,
    );

    // Find available slots after weather clears
    const adapter = new FindATimeAdapter(this.fspClient);
    const slots = await adapter.findSlots({
      operatorId: context.operatorId,
      activityTypeId: weatherContext.activityTypeId ?? "activity-dual",
      instructorIds: weatherContext.instructorId
        ? [weatherContext.instructorId]
        : undefined,
      customerId: weatherContext.studentId,
      startDate: searchStartDate,
      endDate: searchEndDate,
      duration: durationMinutes,
    });

    if (slots.length === 0) {
      return {
        proposedActions: [],
        summary: `No alternative slots found for ${weatherContext.studentName} after weather clears`,
        rawData: {
          weatherContext,
          slotsFound: 0,
          slotsRanked: 0,
        },
      };
    }

    // Deterministic ranking: prefer same-day after weather clears, then next day,
    // prefer same instructor
    const ranked = rankSlots(slots, {
      preferSameInstructor: context.settings.preferSameInstructor,
      preferSameInstructorWeight: context.settings.preferSameInstructorWeight,
      preferSameAircraft: context.settings.preferSameAircraft,
      preferSameAircraftWeight: context.settings.preferSameAircraftWeight,
      preferredInstructorId: weatherContext.instructorId,
      preferredAircraftId: weatherContext.aircraftId,
      originalStartHour: originalStart.getHours(),
    });

    // Take top N from operator settings
    const topN = ranked.slice(0, context.settings.topNAlternatives);

    // Build weather-specific rationale
    const clearsTimeStr = this.formatTime(weatherClearsAt);

    // Include AI urgency reasoning if available
    const urgencyPrefix = weatherContext.urgencyReasoning
      ? `Priority: ${weatherContext.urgencyReasoning} `
      : "";

    // Map to proposal actions
    const proposedActions: ProposalActionInput[] = topN.map((slot, i) => ({
      rank: i + 1,
      actionType: "create_reservation" as const,
      startTime: slot.startTime,
      endTime: slot.endTime,
      locationId: slot.locationId,
      studentId: weatherContext.studentId,
      instructorId: slot.instructorId,
      aircraftId: slot.aircraftId,
      activityTypeId: weatherContext.activityTypeId,
      explanation: `${urgencyPrefix}${weatherContext.reason}. Moving ${weatherContext.studentName}'s lesson to ${this.formatTime(slot.startTime)} when VFR conditions return.${slot.instructorId === weatherContext.instructorId ? ` Same instructor is available.` : ""}`,
    }));

    const urgencySuffix = weatherContext.urgencyScore !== undefined
      ? ` Urgency: ${weatherContext.urgencyScore}/100.`
      : "";

    return {
      proposedActions,
      summary: `IFR conditions forecast until ${clearsTimeStr}. Found ${proposedActions.length} alternative slot(s) for ${weatherContext.studentName}.${urgencySuffix}`,
      rawData: {
        weatherContext,
        slotsFound: slots.length,
        slotsRanked: ranked.length,
        weatherClearsAt: weatherContext.weatherClearsAt,
        urgencyScore: weatherContext.urgencyScore,
        urgencyReasoning: weatherContext.urgencyReasoning,
      },
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
