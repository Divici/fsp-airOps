import type { AuditEventType } from "./audit";

/**
 * A flattened view of an audit event for the UI layer.
 * Maps DB columns to display-friendly fields.
 */
export interface AuditEventView {
  id: string;
  operatorId: number;
  eventType: AuditEventType;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  userId: string | null;
  createdAt: string; // ISO string
}
