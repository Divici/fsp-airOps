// ---------------------------------------------------------------------------
// Inngest Function — Evaluate Schedule (Cancellation Detection)
//
// Cron function that fans out per operator, fetches current reservations,
// compares against the previous snapshot, and creates triggers for any
// detected cancellations.
// ---------------------------------------------------------------------------

import { inngest } from "../client";
import { db } from "@/lib/db";
import { getActiveOperatorIds } from "@/lib/db/queries/operators";
import { CancellationDetector } from "@/lib/engine/detection/cancellation-detector";
import { createSnapshot } from "@/lib/engine/detection/schedule-snapshot";
import type { ScheduleSnapshot } from "@/lib/engine/detection/schedule-snapshot";
import { TriggerService } from "@/lib/engine/trigger-service";
import { createOrchestrator } from "@/lib/engine";
import { createFspClient } from "@/lib/fsp-client";

// ---------------------------------------------------------------------------
// In-memory snapshot store (per operator). In production this would be
// persisted to a database or cache, but for MVP in-memory is sufficient
// since the cron runs frequently and a cold start just skips one cycle.
// ---------------------------------------------------------------------------
const snapshotStore = new Map<number, ScheduleSnapshot>();

/** Exposed for testing — allows injecting/clearing snapshots. */
export function _setSnapshot(
  operatorId: number,
  snapshot: ScheduleSnapshot | null,
): void {
  if (snapshot) {
    snapshotStore.set(operatorId, snapshot);
  } else {
    snapshotStore.delete(operatorId);
  }
}

export function _getSnapshot(
  operatorId: number,
): ScheduleSnapshot | undefined {
  return snapshotStore.get(operatorId);
}

/** Build default query params for a reservation window (today ± 7 days). */
function defaultQueryParams() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  const end = new Date(now);
  end.setDate(end.getDate() + 7);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Cron: Fan-out — runs every 5 minutes, sends one event per operator
// ---------------------------------------------------------------------------
export const evaluateScheduleCron = inngest.createFunction(
  {
    id: "evaluate-schedule-cron",
    name: "Evaluate Schedule — Fan Out",
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const operatorIds = await step.run("get-active-operators", async () => {
      return getActiveOperatorIds(db);
    });

    if (operatorIds.length === 0) {
      return { message: "No active operators found", evaluated: 0 };
    }

    // Send one evaluation event per operator
    await step.sendEvent(
      "fan-out-evaluate",
      operatorIds.map((operatorId) => ({
        name: "scheduler/schedule.evaluate" as const,
        data: { operatorId },
      })),
    );

    return {
      message: `Dispatched evaluation for ${operatorIds.length} operator(s)`,
      evaluated: operatorIds.length,
    };
  },
);

// ---------------------------------------------------------------------------
// Per-operator evaluation — triggered by schedule.evaluate event
// ---------------------------------------------------------------------------
export const evaluateOperatorSchedule = inngest.createFunction(
  {
    id: "evaluate-operator-schedule",
    name: "Evaluate Operator Schedule",
    retries: 3,
  },
  { event: "scheduler/schedule.evaluate" },
  async ({ event, step }) => {
    const { operatorId } = event.data;
    const queryParams = defaultQueryParams();

    // Step 1: Fetch current reservations and build snapshot
    const currentSnapshot = await step.run(
      "fetch-current-schedule",
      async () => {
        const fspClient = createFspClient();
        const detector = new CancellationDetector(fspClient);
        const snapshot = await detector.fetchSnapshot(operatorId, queryParams);
        // Convert Map to array for serialization through Inngest steps
        return {
          operatorId: snapshot.operatorId,
          capturedAt: snapshot.capturedAt.toISOString(),
          reservations: Array.from(snapshot.reservations.entries()),
        };
      },
    );

    // Reconstruct the snapshot from the serialized form
    const reconstructed = createSnapshot(
      currentSnapshot.operatorId,
      currentSnapshot.reservations.map(([, r]) => r),
    );

    // Step 2: Compare with previous snapshot and detect cancellations
    const previousSnapshot = snapshotStore.get(operatorId);

    if (!previousSnapshot) {
      // First run — store baseline, no comparison possible
      snapshotStore.set(operatorId, reconstructed);
      return {
        operatorId,
        status: "baseline_captured",
        reservationCount: reconstructed.reservations.size,
      };
    }

    const detectionResult = await step.run(
      "detect-cancellations",
      async () => {
        // Use previousSnapshot + the already-fetched current data
        const { compareSnapshots } = await import(
          "@/lib/engine/detection/schedule-snapshot"
        );
        const diff = compareSnapshots(previousSnapshot, reconstructed);

        return {
          cancelledCount: diff.cancelled.length,
          addedCount: diff.added.length,
          modifiedCount: diff.modified.length,
          cancellations: diff.cancelled.map((r) => ({
            reservationId: r.reservationId,
            reservationNumber: r.reservationNumber,
            pilotId: r.pilotId,
            pilotName: `${r.pilotFirstName} ${r.pilotLastName}`,
            resource: r.resource,
            start: r.start,
            end: r.end,
          })),
        };
      },
    );

    // Step 3: Create triggers for each cancellation
    const triggerResults = [];

    if (detectionResult.cancellations.length > 0) {
      const results = await step.run(
        "create-cancellation-triggers",
        async () => {
          const fspClient = createFspClient();
          const orchestrator = createOrchestrator(db, fspClient);
          const triggerService = new TriggerService(db, orchestrator);
          const outcomes = [];

          for (const cancellation of detectionResult.cancellations) {
            const result = await triggerService.createAndDispatch({
              operatorId,
              type: "cancellation",
              sourceEntityId: cancellation.reservationId,
              sourceEntityType: "reservation",
              context: {
                reservationNumber: cancellation.reservationNumber,
                pilotId: cancellation.pilotId,
                pilotName: cancellation.pilotName,
                resource: cancellation.resource,
                originalStart: cancellation.start,
                originalEnd: cancellation.end,
              },
            });

            outcomes.push({
              reservationId: cancellation.reservationId,
              triggerId: result.triggerId,
              dispatched: result.dispatched,
              duplicate: result.duplicate,
            });
          }

          return outcomes;
        },
      );

      triggerResults.push(...results);
    }

    // Update stored snapshot
    snapshotStore.set(operatorId, reconstructed);

    return {
      operatorId,
      status: "evaluated",
      cancelledCount: detectionResult.cancelledCount,
      addedCount: detectionResult.addedCount,
      modifiedCount: detectionResult.modifiedCount,
      triggers: triggerResults,
    };
  },
);
