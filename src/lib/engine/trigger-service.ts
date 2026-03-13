// ---------------------------------------------------------------------------
// Trigger Service — Create, deduplicate, and dispatch scheduling triggers
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { TriggerType } from "@/lib/types/domain";
import type { EngineExecutionResult } from "./types";
import type { Orchestrator } from "./orchestrator";
import {
  createTrigger,
  getTriggerById,
  isDuplicateTrigger,
  updateTriggerStatus,
  markTriggerProcessed,
} from "@/lib/db/queries/triggers";

export interface CreateTriggerParams {
  operatorId: number;
  type: TriggerType;
  sourceEntityId?: string;
  sourceEntityType?: string;
  context?: Record<string, unknown>;
}

export interface CreateTriggerResult {
  triggerId: string;
  duplicate: boolean;
}

export interface CreateAndDispatchResult {
  triggerId: string;
  dispatched: boolean;
  duplicate: boolean;
  result?: EngineExecutionResult;
}

export class TriggerService {
  constructor(
    private db: PostgresJsDatabase,
    private orchestrator: Orchestrator
  ) {}

  /**
   * Create a trigger with deduplication, then dispatch to the orchestrator.
   *
   * If a duplicate trigger is found within the dedup window, returns early
   * with `duplicate: true` and `dispatched: false`.
   */
  async createAndDispatch(
    params: CreateTriggerParams
  ): Promise<CreateAndDispatchResult> {
    // 1. Check for duplicates (only when sourceEntityId is provided)
    if (params.sourceEntityId) {
      const duplicate = await isDuplicateTrigger(this.db, {
        operatorId: params.operatorId,
        type: params.type,
        sourceEntityId: params.sourceEntityId,
      });

      if (duplicate) {
        return { triggerId: "", dispatched: false, duplicate: true };
      }
    }

    // 2. Create trigger
    const triggerId = await createTrigger(this.db, params);

    // 3. Update status to processing
    await updateTriggerStatus(
      this.db,
      params.operatorId,
      triggerId,
      "processing"
    );

    // 4. Fetch the full trigger record for the orchestrator
    const trigger = await getTriggerById(
      this.db,
      params.operatorId,
      triggerId
    );

    if (!trigger) {
      throw new Error(`Trigger ${triggerId} not found after creation`);
    }

    // 5. Execute workflow
    try {
      const result = await this.orchestrator.executeWorkflow(trigger);

      if (result.success) {
        await markTriggerProcessed(this.db, params.operatorId, triggerId);
      } else {
        await updateTriggerStatus(
          this.db,
          params.operatorId,
          triggerId,
          "failed",
          result.error
        );
      }

      return { triggerId, dispatched: true, duplicate: false, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await updateTriggerStatus(
        this.db,
        params.operatorId,
        triggerId,
        "failed",
        message
      );
      return {
        triggerId,
        dispatched: true,
        duplicate: false,
        result: {
          triggerId,
          success: false,
          error: message,
          auditTrail: [],
        },
      };
    }
  }

  /**
   * Create a trigger without dispatching (useful for batch processing).
   */
  async createTrigger(
    params: CreateTriggerParams
  ): Promise<CreateTriggerResult> {
    // Check for duplicates when sourceEntityId is provided
    if (params.sourceEntityId) {
      const duplicate = await isDuplicateTrigger(this.db, {
        operatorId: params.operatorId,
        type: params.type,
        sourceEntityId: params.sourceEntityId,
      });

      if (duplicate) {
        return { triggerId: "", duplicate: true };
      }
    }

    const triggerId = await createTrigger(this.db, params);
    return { triggerId, duplicate: false };
  }

  /**
   * Dispatch an existing trigger by ID.
   */
  async dispatchTrigger(
    operatorId: number,
    triggerId: string
  ): Promise<EngineExecutionResult> {
    const trigger = await getTriggerById(this.db, operatorId, triggerId);

    if (!trigger) {
      throw new Error(`Trigger ${triggerId} not found`);
    }

    // Update status to processing
    await updateTriggerStatus(this.db, operatorId, triggerId, "processing");

    try {
      const result = await this.orchestrator.executeWorkflow(trigger);

      if (result.success) {
        await markTriggerProcessed(this.db, operatorId, triggerId);
      } else {
        await updateTriggerStatus(
          this.db,
          operatorId,
          triggerId,
          "failed",
          result.error
        );
      }

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await updateTriggerStatus(
        this.db,
        operatorId,
        triggerId,
        "failed",
        message
      );
      return {
        triggerId,
        success: false,
        error: message,
        auditTrail: [],
      };
    }
  }
}
