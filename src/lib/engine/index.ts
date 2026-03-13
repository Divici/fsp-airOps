// ---------------------------------------------------------------------------
// Engine Factory — Creates a configured Orchestrator instance
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IFspClient } from "@/lib/fsp-client";
import { Orchestrator } from "./orchestrator";
import { WorkflowRegistry } from "./workflow-registry";
import { AuditService } from "./audit";
import { RescheduleWorkflowHandler } from "./workflows/reschedule";

export function createOrchestrator(
  db: PostgresJsDatabase,
  fspClient: IFspClient
): Orchestrator {
  const registry = new WorkflowRegistry();
  registry.register(new RescheduleWorkflowHandler(fspClient));
  const auditService = new AuditService(db);
  return new Orchestrator(db, fspClient, registry, auditService);
}

// Re-exports
export { Orchestrator } from "./orchestrator";
export { WorkflowRegistry, triggerToWorkflow } from "./workflow-registry";
export { AuditService } from "./audit";
export type {
  WorkflowHandler,
  PipelineStepResult,
  EngineExecutionResult,
} from "./types";
export {
  loadOperatorSettings,
  buildWorkflowContext,
  buildProposal,
} from "./pipeline";
