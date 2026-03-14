// ---------------------------------------------------------------------------
// AuditService — Higher-level audit logging with convenience methods
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { insertAuditEvent, queryAuditEvents } from "@/lib/db/queries/audit";
import { AUDIT_EVENT_TYPES } from "@/lib/types/audit";
import type { AuditEventType } from "@/lib/types/audit";
import type { AuditEvent } from "@/lib/db/schema";

export class AuditService {
  constructor(private db: PostgresJsDatabase) {}

  // ---------------------------------------------------------------------------
  // Generic logger
  // ---------------------------------------------------------------------------

  async logEvent(
    operatorId: number,
    eventType: AuditEventType,
    params?: {
      entityId?: string;
      entityType?: string;
      payload?: Record<string, unknown>;
    }
  ): Promise<void> {
    await insertAuditEvent(this.db, {
      operatorId,
      eventType,
      entityId: params?.entityId,
      entityType: params?.entityType,
      payload: params?.payload,
    });
  }

  // ---------------------------------------------------------------------------
  // Convenience — Trigger events
  // ---------------------------------------------------------------------------

  async logTriggerReceived(
    operatorId: number,
    triggerId: string,
    triggerType: string
  ): Promise<void> {
    await this.logEvent(operatorId, AUDIT_EVENT_TYPES.TRIGGER_RECEIVED, {
      entityId: triggerId,
      entityType: "trigger",
      payload: { triggerType },
    });
  }

  // ---------------------------------------------------------------------------
  // Convenience — Proposal events
  // ---------------------------------------------------------------------------

  async logProposalGenerated(
    operatorId: number,
    proposalId: string,
    workflowType: string
  ): Promise<void> {
    await this.logEvent(operatorId, AUDIT_EVENT_TYPES.PROPOSAL_GENERATED, {
      entityId: proposalId,
      entityType: "proposal",
      payload: { workflowType },
    });
  }

  // ---------------------------------------------------------------------------
  // Convenience — Approval events
  // ---------------------------------------------------------------------------

  async logProposalApproved(
    operatorId: number,
    proposalId: string,
    userId: string
  ): Promise<void> {
    await this.logEvent(operatorId, AUDIT_EVENT_TYPES.PROPOSAL_APPROVED, {
      entityId: proposalId,
      entityType: "proposal",
      payload: { userId },
    });
  }

  async logProposalDeclined(
    operatorId: number,
    proposalId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    await this.logEvent(operatorId, AUDIT_EVENT_TYPES.PROPOSAL_DECLINED, {
      entityId: proposalId,
      entityType: "proposal",
      payload: { userId, ...(reason !== undefined ? { reason } : {}) },
    });
  }

  // ---------------------------------------------------------------------------
  // Convenience — Execution events
  // ---------------------------------------------------------------------------

  async logReservationCreated(
    operatorId: number,
    proposalActionId: string,
    fspReservationId: string
  ): Promise<void> {
    await this.logEvent(operatorId, AUDIT_EVENT_TYPES.RESERVATION_CREATED, {
      entityId: proposalActionId,
      entityType: "proposal_action",
      payload: { fspReservationId },
    });
  }

  async logReservationFailed(
    operatorId: number,
    proposalActionId: string,
    error: string
  ): Promise<void> {
    await this.logEvent(operatorId, AUDIT_EVENT_TYPES.RESERVATION_FAILED, {
      entityId: proposalActionId,
      entityType: "proposal_action",
      payload: { error },
    });
  }

  // ---------------------------------------------------------------------------
  // Convenience — Auto-approval events
  // ---------------------------------------------------------------------------

  async logProposalAutoApproved(
    operatorId: number,
    proposalId: string,
    confidence: number,
    threshold: number,
  ): Promise<void> {
    await this.logEvent(operatorId, AUDIT_EVENT_TYPES.PROPOSAL_AUTO_APPROVED, {
      entityId: proposalId,
      entityType: "proposal",
      payload: { confidence, threshold },
    });
  }

  async logProposalAutoDeferred(
    operatorId: number,
    proposalId: string,
    confidence: number,
    threshold: number,
    reasoning: string,
  ): Promise<void> {
    await this.logEvent(operatorId, AUDIT_EVENT_TYPES.PROPOSAL_AUTO_DEFERRED, {
      entityId: proposalId,
      entityType: "proposal",
      payload: { confidence, threshold, reasoning },
    });
  }

  // ---------------------------------------------------------------------------
  // Query helpers
  // ---------------------------------------------------------------------------

  async getEventsForEntity(
    operatorId: number,
    entityId: string,
    entityType?: string
  ): Promise<AuditEvent[]> {
    const { events } = await queryAuditEvents(this.db, {
      operatorId,
      entityId,
      entityType,
      limit: 1000,
    });
    return events;
  }

  async getRecentEvents(
    operatorId: number,
    limit = 50
  ): Promise<AuditEvent[]> {
    const { events } = await queryAuditEvents(this.db, {
      operatorId,
      limit,
    });
    return events;
  }
}
