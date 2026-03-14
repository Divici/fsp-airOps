// ---------------------------------------------------------------------------
// Orchestrator — Central entry point for workflow execution
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IFspClient } from "@/lib/fsp-client";
import type { SchedulingTrigger } from "@/lib/db/schema";
import { AUDIT_EVENT_TYPES } from "@/lib/types/audit";
import { inngest } from "@/inngest/client";
import type { EngineExecutionResult } from "./types";
import { WorkflowRegistry, triggerToWorkflow } from "./workflow-registry";
import { AuditService } from "./audit";
import {
  loadOperatorSettings,
  buildWorkflowContext,
  buildProposal,
} from "./pipeline";

export class Orchestrator {
  constructor(
    private db: PostgresJsDatabase,
    private fspClient: IFspClient,
    private registry: WorkflowRegistry,
    private auditService: AuditService
  ) {}

  async executeWorkflow(
    trigger: SchedulingTrigger
  ): Promise<EngineExecutionResult> {
    const auditTrail: string[] = [];

    try {
      // 1. Log trigger received
      await this.auditService.logTriggerReceived(
        trigger.operatorId,
        trigger.id,
        trigger.type
      );

      // 2. Resolve workflow type from trigger
      const workflowType = triggerToWorkflow(trigger.type);
      if (!workflowType) {
        throw new Error(
          `No workflow mapping for trigger type: ${trigger.type}`
        );
      }

      // 3. Get handler from registry
      const handler = this.registry.getHandler(workflowType);
      if (!handler) {
        throw new Error(
          `No handler registered for workflow: ${workflowType}`
        );
      }

      // 4. Load operator settings
      const settings = await loadOperatorSettings(this.db, trigger.operatorId);

      // 5. Build context
      const context = buildWorkflowContext(trigger, settings, this.fspClient);

      // 6. Execute workflow
      const result = await handler.execute(context);

      // 7. Build and persist proposal (placeholder for now)
      const proposalId = await buildProposal(
        this.db,
        trigger.operatorId,
        trigger,
        result
      );

      // 8. Fire async auto-approval evaluation
      try {
        await inngest.send({
          name: "scheduler/proposal.evaluate-auto-approval",
          data: {
            proposalId,
            operatorId: trigger.operatorId,
            triggerId: trigger.id,
          },
        });
      } catch {
        // Non-critical — auto-approval is best-effort
      }

      // 9. Log success
      await this.auditService.logProposalGenerated(
        trigger.operatorId,
        proposalId,
        workflowType
      );

      return {
        triggerId: trigger.id,
        proposalId,
        success: true,
        auditTrail,
      };
    } catch (error) {
      // Log failure
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await this.auditService.logEvent(
        trigger.operatorId,
        AUDIT_EVENT_TYPES.TRIGGER_FAILED,
        {
          entityId: trigger.id,
          entityType: "trigger",
          payload: { error: message },
        }
      );

      return {
        triggerId: trigger.id,
        success: false,
        error: message,
        auditTrail,
      };
    }
  }
}
