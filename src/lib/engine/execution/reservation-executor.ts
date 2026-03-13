// ---------------------------------------------------------------------------
// ReservationExecutor — Validate-then-create pipeline for approved proposals
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { formatInTimeZone } from "date-fns-tz";
import type { IFspClient } from "@/lib/fsp-client/types";
import type { AuditService } from "@/lib/engine/audit";
import type { ProposalAction } from "@/lib/db/schema";
import type { FspReservationCreate } from "@/lib/types/fsp";
import {
  getProposalById,
  updateProposalStatus,
  updateActionExecutionStatus,
} from "@/lib/db/queries/proposals";
import { assertTransition } from "@/lib/engine/proposal-lifecycle";
import { FreshnessChecker } from "./freshness-check";
import type { ExecutionResult, ProposalExecutionResult } from "./types";

/**
 * Resolves the IANA timezone for a given locationId.
 * In production this would query the FSP locations endpoint or a cache.
 * For now we accept an explicit map so callers can inject it.
 */
export type TimezoneResolver = (locationId: number) => string;

/** Default resolver: falls back to UTC when no mapping is provided. */
const DEFAULT_TZ_RESOLVER: TimezoneResolver = () => "UTC";

export interface ReservationExecutorOptions {
  /** Maps locationId → IANA timezone (e.g. "America/Los_Angeles") */
  timezoneResolver?: TimezoneResolver;
}

/**
 * Executes an approved proposal by validating and creating each action's
 * reservation in FSP using the validate-then-create pattern.
 *
 * Pipeline per action:
 *   1. Freshness check (slot still available?)
 *   2. Build reservation payload (UTC → local time)
 *   3. Validate with FSP
 *   4. Create with FSP
 *   5. Record result + audit trail
 */
export class ReservationExecutor {
  private freshnessChecker: FreshnessChecker;
  private timezoneResolver: TimezoneResolver;

  constructor(
    private db: PostgresJsDatabase,
    private fspClient: IFspClient,
    private auditService: AuditService,
    options: ReservationExecutorOptions = {}
  ) {
    this.freshnessChecker = new FreshnessChecker(fspClient);
    this.timezoneResolver = options.timezoneResolver ?? DEFAULT_TZ_RESOLVER;
  }

  // -------------------------------------------------------------------------
  // Public
  // -------------------------------------------------------------------------

  async executeProposal(
    operatorId: number,
    proposalId: string
  ): Promise<ProposalExecutionResult> {
    // 1. Load proposal with actions
    const proposal = await getProposalById(this.db, operatorId, proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    // 2. Verify the proposal is approved (only approved → executed/failed is valid)
    assertTransition(proposal.status!, "executed");

    // 3. Execute each action sequentially
    const results: ExecutionResult[] = [];
    for (const action of proposal.actions) {
      const result = await this.executeAction(operatorId, action);
      results.push(result);
    }

    // 4. Determine aggregate outcome
    const allSucceeded = results.every((r) => r.success);
    const newStatus = allSucceeded ? "executed" : "failed";
    await updateProposalStatus(this.db, operatorId, proposalId, newStatus);

    return {
      proposalId,
      success: allSucceeded,
      results,
      errors: results.filter((r) => !r.success).map((r) => r.error!),
    };
  }

  // -------------------------------------------------------------------------
  // Private — Per-action pipeline
  // -------------------------------------------------------------------------

  private async executeAction(
    operatorId: number,
    action: ProposalAction
  ): Promise<ExecutionResult> {
    try {
      // Step 1: Freshness check
      const freshness = await this.freshnessChecker.checkSlotAvailable({
        operatorId,
        startTime: action.startTime,
        endTime: action.endTime,
        instructorId: action.instructorId,
        aircraftId: action.aircraftId,
        locationId: action.locationId,
      });

      if (!freshness.available) {
        const reason = freshness.reason ?? "Slot no longer available";
        await updateActionExecutionStatus(this.db, operatorId, action.id, {
          validationStatus: "stale",
          executionStatus: "failed",
          executionError: reason,
        });
        await this.auditService.logEvent(operatorId, "validation_failed", {
          entityId: action.id,
          entityType: "proposal_action",
          payload: { reason },
        });
        return { actionId: action.id, success: false, error: reason };
      }

      // Step 2: Build FSP reservation payload (local time!)
      const reservationPayload = this.buildReservationPayload(
        operatorId,
        action
      );

      // Step 3: Validate with FSP
      const validationResult = await this.fspClient.validateReservation(
        operatorId,
        reservationPayload
      );

      if (validationResult.errors.length > 0) {
        const errorMsg = validationResult.errors
          .map((e) => e.message)
          .join("; ");
        await updateActionExecutionStatus(this.db, operatorId, action.id, {
          validationStatus: "invalid",
          executionStatus: "failed",
          executionError: errorMsg,
        });
        await this.auditService.logEvent(operatorId, "validation_failed", {
          entityId: action.id,
          entityType: "proposal_action",
          payload: {
            errors: validationResult.errors,
          },
        });
        return { actionId: action.id, success: false, error: errorMsg };
      }

      await updateActionExecutionStatus(this.db, operatorId, action.id, {
        validationStatus: "valid",
      });
      await this.auditService.logEvent(operatorId, "validation_passed", {
        entityId: action.id,
        entityType: "proposal_action",
      });

      // Step 4: Create reservation in FSP
      const createResult = await this.fspClient.createReservation(
        operatorId,
        reservationPayload
      );

      if (createResult.errors.length > 0) {
        const errorMsg = createResult.errors.map((e) => e.message).join("; ");
        await updateActionExecutionStatus(this.db, operatorId, action.id, {
          executionStatus: "failed",
          executionError: errorMsg,
        });
        await this.auditService.logReservationFailed(
          operatorId,
          action.id,
          errorMsg
        );
        return { actionId: action.id, success: false, error: errorMsg };
      }

      // Step 5: Record success
      await updateActionExecutionStatus(this.db, operatorId, action.id, {
        executionStatus: "created",
        fspReservationId: createResult.id,
      });
      await this.auditService.logReservationCreated(
        operatorId,
        action.id,
        createResult.id!
      );

      return {
        actionId: action.id,
        success: true,
        fspReservationId: createResult.id,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown execution error";
      await updateActionExecutionStatus(this.db, operatorId, action.id, {
        executionStatus: "failed",
        executionError: errorMsg,
      });
      await this.auditService.logReservationFailed(
        operatorId,
        action.id,
        errorMsg
      );
      return { actionId: action.id, success: false, error: errorMsg };
    }
  }

  // -------------------------------------------------------------------------
  // Private — Payload builders
  // -------------------------------------------------------------------------

  /**
   * Build the FSP reservation create payload.
   * IMPORTANT: start/end times must be in LOCAL TIME (no timezone suffix).
   * We use date-fns-tz to convert from UTC to the location's timezone.
   */
  private buildReservationPayload(
    operatorId: number,
    action: ProposalAction
  ): FspReservationCreate {
    const tz = this.timezoneResolver(action.locationId);
    const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

    return {
      operatorId,
      locationId: action.locationId,
      aircraftId: action.aircraftId ?? "",
      activityTypeId: action.activityTypeId ?? "",
      pilotId: action.studentId,
      instructorId: action.instructorId ?? undefined,
      start: formatInTimeZone(action.startTime, tz, LOCAL_FORMAT),
      end: formatInTimeZone(action.endTime, tz, LOCAL_FORMAT),
    };
  }
}
