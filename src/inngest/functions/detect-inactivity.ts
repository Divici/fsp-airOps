// ---------------------------------------------------------------------------
// Inngest Function — Detect Inactivity (Fan-out per Operator)
//
// Cron function that fans out per operator, runs the InactivityDetector,
// and creates triggers for each inactive student to dispatch the
// inactivity outreach workflow.
// ---------------------------------------------------------------------------

import { inngest } from "../client";
import { db } from "@/lib/db";
import { getActiveOperatorIds } from "@/lib/db/queries/operators";
import { getOperatorSettings } from "@/lib/db/queries/operator-settings";
import { InactivityDetector } from "@/lib/engine/detection/inactivity-detector";
import { TriggerService } from "@/lib/engine/trigger-service";
import { createOrchestrator } from "@/lib/engine";
import { createFspClient } from "@/lib/fsp-client";

// ---------------------------------------------------------------------------
// Cron: Fan-out — runs every 6 hours, sends one event per operator
// ---------------------------------------------------------------------------
export const detectInactivityCron = inngest.createFunction(
  {
    id: "detect-inactivity-cron",
    name: "Detect Inactivity — Fan Out",
  },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const operatorIds = await step.run("get-active-operators", async () => {
      return getActiveOperatorIds(db);
    });

    if (operatorIds.length === 0) {
      return { message: "No active operators found", evaluated: 0 };
    }

    // Send one inactivity evaluation event per operator
    await step.sendEvent(
      "fan-out-inactivity",
      operatorIds.map((operatorId) => ({
        name: "scheduler/inactivity.evaluate" as const,
        data: { operatorId },
      })),
    );

    return {
      message: `Dispatched inactivity detection for ${operatorIds.length} operator(s)`,
      evaluated: operatorIds.length,
    };
  },
);

// ---------------------------------------------------------------------------
// Per-operator inactivity evaluation — triggered by inactivity.evaluate event
// ---------------------------------------------------------------------------
export const evaluateOperatorInactivity = inngest.createFunction(
  {
    id: "evaluate-operator-inactivity",
    name: "Evaluate Operator Inactivity",
    retries: 3,
  },
  { event: "scheduler/inactivity.evaluate" },
  async ({ event, step }) => {
    const { operatorId } = event.data;

    // Step 1: Check if inactivity_outreach is enabled for this operator
    const settings = await step.run("load-operator-settings", async () => {
      const s = await getOperatorSettings(db, operatorId);
      return {
        enabledWorkflows: s.enabledWorkflows as Record<string, boolean>,
        inactivityThresholdDays: s.inactivityThresholdDays,
      };
    });

    if (!settings.enabledWorkflows?.inactivity_outreach) {
      return {
        operatorId,
        status: "skipped",
        reason: "inactivity_outreach workflow not enabled",
      };
    }

    const thresholdDays = settings.inactivityThresholdDays ?? 7;

    // Step 2: Detect inactive students
    const inactiveStudents = await step.run(
      "detect-inactive-students",
      async () => {
        const fspClient = createFspClient();
        const detector = new InactivityDetector(fspClient);
        const students = await detector.detectInactiveStudents(
          operatorId,
          thresholdDays,
        );

        // Serialize dates for Inngest step transport
        return students.map((s) => ({
          studentId: s.studentId,
          studentName: s.studentName,
          email: s.email,
          lastFlightDate: s.lastFlightDate?.toISOString() ?? null,
          daysSinceLastFlight: s.daysSinceLastFlight,
        }));
      },
    );

    if (inactiveStudents.length === 0) {
      return {
        operatorId,
        status: "no_inactive_students",
        studentsChecked: 0,
      };
    }

    // Step 3: Create triggers for each inactive student
    const triggerResults = await step.run(
      "create-inactivity-triggers",
      async () => {
        const fspClient = createFspClient();
        const orchestrator = createOrchestrator(db, fspClient);
        const triggerService = new TriggerService(db, orchestrator);
        const outcomes = [];

        for (const student of inactiveStudents) {
          const result = await triggerService.createAndDispatch({
            operatorId,
            type: "inactivity_detected",
            sourceEntityId: student.studentId,
            sourceEntityType: "student",
            context: {
              studentId: student.studentId,
              studentName: student.studentName,
              email: student.email,
              lastFlightDate: student.lastFlightDate,
              daysSinceLastFlight: student.daysSinceLastFlight,
            },
          });

          outcomes.push({
            studentId: student.studentId,
            studentName: student.studentName,
            triggerId: result.triggerId,
            dispatched: result.dispatched,
            duplicate: result.duplicate,
          });
        }

        return outcomes;
      },
    );

    return {
      operatorId,
      status: "evaluated",
      inactiveStudentsFound: inactiveStudents.length,
      triggers: triggerResults,
    };
  },
);
