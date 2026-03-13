// ---------------------------------------------------------------------------
// Pipeline Steps — Shared steps that every workflow execution goes through
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IFspClient } from "@/lib/fsp-client";
import type { OperatorSettings, SchedulingTrigger } from "@/lib/db/schema";
import type { WorkflowContext, WorkflowResult } from "@/lib/types/workflow";
import { getOperatorSettings } from "@/lib/db/queries/operator-settings";
import { randomUUID } from "crypto";

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
 * Step 5: Build proposal from workflow result.
 *
 * Placeholder — will be fleshed out in Task 2.2.
 * For now, returns a mock proposal ID.
 */
export async function buildProposal(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _db: PostgresJsDatabase,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _operatorId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _trigger: SchedulingTrigger,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _workflowResult: WorkflowResult
): Promise<string> {
  // TODO: Persist proposal + actions to DB in Task 2.2
  return randomUUID();
}
