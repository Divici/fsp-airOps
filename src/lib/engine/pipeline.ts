// ---------------------------------------------------------------------------
// Pipeline Steps — Shared steps that every workflow execution goes through
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IFspClient } from "@/lib/fsp-client";
import type { OperatorSettings, SchedulingTrigger } from "@/lib/db/schema";
import type { WorkflowContext, WorkflowResult } from "@/lib/types/workflow";
import { getOperatorSettings } from "@/lib/db/queries/operator-settings";
import { ProposalBuilder } from "./proposal-builder";
import { triggerToWorkflow } from "./workflow-registry";

/**
 * Step 2: Load operator settings (with defaults fallback).
 */
export async function loadOperatorSettings(
  db: PostgresJsDatabase,
  operatorId: number
): Promise<OperatorSettings> {
  return getOperatorSettings(db, operatorId);
}

/**
 * Step 3: Create workflow context from trigger + settings.
 */
export function buildWorkflowContext(
  trigger: SchedulingTrigger,
  settings: OperatorSettings,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fspClient: IFspClient
): WorkflowContext {
  return {
    operatorId: trigger.operatorId,
    trigger,
    settings,
  };
}

/**
 * Step 5: Build proposal from workflow result and persist it.
 */
export async function buildProposal(
  db: PostgresJsDatabase,
  operatorId: number,
  trigger: SchedulingTrigger,
  workflowResult: WorkflowResult
): Promise<string> {
  const workflowType = triggerToWorkflow(trigger.type);
  if (!workflowType) {
    throw new Error(`No workflow mapping for trigger type: ${trigger.type}`);
  }

  const builder = new ProposalBuilder(db);
  return builder.buildAndPersist({
    operatorId,
    workflowType,
    triggerId: trigger.id,
    result: workflowResult,
  });
}
