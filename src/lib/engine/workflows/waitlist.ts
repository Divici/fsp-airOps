// ---------------------------------------------------------------------------
// Waitlist Workflow Handler
// Triggered by a schedule opening — finds, ranks, and proposes candidates.
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type { WorkflowHandler } from "../types";
import type {
  WorkflowContext,
  WorkflowResult,
  ProposalActionInput,
} from "@/lib/types/workflow";
import { CandidateFinder } from "../waitlist/candidate-finder";
import { WaitlistRanker } from "../waitlist/ranker";
import { FindATimeAdapter } from "../scheduling/find-a-time-adapter";
import type { WaitlistWorkflowContext } from "./waitlist.types";
import type { WaitlistWeights } from "../waitlist/types";

export class WaitlistWorkflowHandler implements WorkflowHandler {
  type = "waitlist" as const;

  constructor(private fspClient: IFspClient) {}

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const openingContext =
      context.trigger.context as WaitlistWorkflowContext | null;

    if (!openingContext) {
      return {
        proposedActions: [],
        summary: "No opening context provided",
        rawData: { error: "missing_context" },
      };
    }

    const openingStart = new Date(openingContext.openingStart);
    const openingEnd = new Date(openingContext.openingEnd);
    const durationMinutes = Math.round(
      (openingEnd.getTime() - openingStart.getTime()) / 60_000,
    );

    // 1. Find eligible candidates
    const candidateFinder = new CandidateFinder(this.fspClient);
    const candidates = await candidateFinder.findCandidates(
      context.operatorId,
      {
        timeWindow: { start: openingStart, end: openingEnd },
        locationId: openingContext.locationId,
        aircraftType: openingContext.aircraftType,
        activityTypeId: openingContext.activityTypeId,
      },
    );

    if (candidates.length === 0) {
      return {
        proposedActions: [],
        summary: "No eligible candidates found for the opening",
        rawData: {
          openingContext,
          candidatesFound: 0,
        },
      };
    }

    // 2. Rank candidates using operator weights
    const weights: WaitlistWeights = {
      timeSinceLastFlight: context.settings.timeSinceLastFlightWeight,
      timeUntilNextFlight: context.settings.timeUntilNextFlightWeight,
      totalHours: context.settings.totalFlightHoursWeight,
      instructorContinuity: context.settings.preferSameInstructorWeight,
      aircraftFamiliarity: context.settings.preferSameAircraftWeight,
    };

    const ranker = new WaitlistRanker(weights);
    const ranked = ranker.rankCandidates(candidates);

    // 3. Take top-N candidates
    const topN = ranked.slice(0, context.settings.topNAlternatives);

    // 4. Find available slots for each candidate using Find-a-Time
    const adapter = new FindATimeAdapter(this.fspClient);
    const searchStartDate = this.formatDate(openingStart);
    const searchEndDate = this.formatDate(openingEnd);

    const proposedActions: ProposalActionInput[] = [];

    for (let i = 0; i < topN.length; i++) {
      const candidate = topN[i];

      const slots = await adapter.findSlots({
        operatorId: context.operatorId,
        activityTypeId:
          openingContext.activityTypeId ?? "at-1",
        customerId: candidate.studentId,
        startDate: searchStartDate,
        endDate: searchEndDate,
        duration: durationMinutes,
        instructorIds: openingContext.instructorId
          ? [openingContext.instructorId]
          : undefined,
      });

      if (slots.length > 0) {
        const bestSlot = slots[0];
        proposedActions.push({
          rank: i + 1,
          actionType: "create_reservation" as const,
          startTime: bestSlot.startTime,
          endTime: bestSlot.endTime,
          locationId: bestSlot.locationId,
          studentId: candidate.studentId,
          instructorId: bestSlot.instructorId,
          aircraftId: bestSlot.aircraftId,
          activityTypeId: openingContext.activityTypeId,
          explanation: `Waitlist candidate ${candidate.studentName} (score: ${candidate.eligibilityScore})`,
        });
      }
    }

    return {
      proposedActions,
      summary: `Found ${proposedActions.length} waitlist candidates for opening at ${searchStartDate}`,
      rawData: {
        openingContext,
        candidatesFound: candidates.length,
        candidatesRanked: ranked.length,
        proposalsGenerated: proposedActions.length,
      },
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}
