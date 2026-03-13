// ---------------------------------------------------------------------------
// Inngest Function — Process Scheduling Trigger
// Receives a trigger event and dispatches it to the orchestration engine.
// ---------------------------------------------------------------------------

import { inngest } from "../client";
import { db } from "@/lib/db";
import { getTriggerById } from "@/lib/db/queries/triggers";
import { createOrchestrator } from "@/lib/engine";
import { createFspClient } from "@/lib/fsp-client";
import { TriggerService } from "@/lib/engine/trigger-service";

export const processTrigger = inngest.createFunction(
  { id: "process-trigger", name: "Process Scheduling Trigger" },
  { event: "scheduler/trigger.received" },
  async ({ event, step }) => {
    const { triggerId, operatorId } = event.data;

    // Step 1: Load trigger from DB
    const trigger = await step.run("load-trigger", async () => {
      const found = await getTriggerById(db, operatorId, triggerId);
      if (!found) {
        throw new Error(`Trigger ${triggerId} not found`);
      }
      return found;
    });

    // Step 2: Dispatch to orchestrator
    const result = await step.run("execute-workflow", async () => {
      const fspClient = createFspClient();
      const orchestrator = createOrchestrator(db, fspClient);
      const triggerService = new TriggerService(db, orchestrator);
      return triggerService.dispatchTrigger(operatorId, trigger.id);
    });

    return result;
  }
);
