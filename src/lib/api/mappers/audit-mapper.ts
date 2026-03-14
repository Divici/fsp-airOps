// ---------------------------------------------------------------------------
// Audit Mapper — DB rows → AuditEventView
// ---------------------------------------------------------------------------

import type { AuditEvent } from "@/lib/db/schema";
import type { AuditEventView } from "@/lib/types/audit-view";
import type { AuditEventType } from "@/lib/types/audit";

const SUMMARY_TEMPLATES: Record<string, string> = {
  trigger_received: "Trigger received",
  trigger_processed: "Trigger processed successfully",
  trigger_failed: "Trigger processing failed",
  trigger_skipped: "Trigger skipped — duplicate event",
  proposal_generated: "Proposal generated",
  proposal_expired: "Proposal expired without review",
  proposal_approved: "Proposal approved",
  proposal_declined: "Proposal declined",
  validation_passed: "Reservation validation passed",
  validation_failed: "Reservation validation failed",
  reservation_created: "Reservation created in FSP",
  reservation_failed: "Reservation creation failed",
  email_sent: "Email notification sent",
  email_failed: "Email delivery failed",
  sms_sent: "SMS notification sent",
  sms_failed: "SMS delivery failed",
};

function generateSummary(eventType: string, payload: unknown): string {
  const base = SUMMARY_TEMPLATES[eventType] ?? `Event: ${eventType}`;
  const p = payload as Record<string, unknown> | null;

  // Enrich with entity ID or name if present in payload
  if (p?.proposalId) return `${base} (${p.proposalId})`;
  if (p?.triggerId) return `${base} (${p.triggerId})`;
  if (p?.studentName) return `${base} for ${p.studentName}`;
  return base;
}

export function toAuditEventView(row: AuditEvent): AuditEventView {
  return {
    id: row.id,
    operatorId: row.operatorId,
    eventType: row.eventType as AuditEventType,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    summary: generateSummary(row.eventType, row.payload),
    details: (row.payload as Record<string, unknown>) ?? null,
    userId: (row.payload as Record<string, unknown>)?.userId as string ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapAuditEvents(rows: AuditEvent[]): AuditEventView[] {
  return rows.map(toAuditEventView);
}
