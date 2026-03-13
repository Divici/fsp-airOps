// ---------------------------------------------------------------------------
// Audit Event Types — Typed constants and payload interfaces
// ---------------------------------------------------------------------------

export const AUDIT_EVENT_TYPES = {
  // Trigger events
  TRIGGER_RECEIVED: "trigger_received",
  TRIGGER_PROCESSED: "trigger_processed",
  TRIGGER_FAILED: "trigger_failed",
  TRIGGER_SKIPPED: "trigger_skipped",

  // Proposal events
  PROPOSAL_GENERATED: "proposal_generated",
  PROPOSAL_EXPIRED: "proposal_expired",

  // Approval events
  PROPOSAL_APPROVED: "proposal_approved",
  PROPOSAL_DECLINED: "proposal_declined",

  // Execution events
  VALIDATION_PASSED: "validation_passed",
  VALIDATION_FAILED: "validation_failed",
  RESERVATION_CREATED: "reservation_created",
  RESERVATION_FAILED: "reservation_failed",

  // Communication events
  EMAIL_SENT: "email_sent",
  EMAIL_FAILED: "email_failed",
  SMS_SENT: "sms_sent",
  SMS_FAILED: "sms_failed",
} as const;

export type AuditEventType =
  (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES];
