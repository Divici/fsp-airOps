// ---------------------------------------------------------------------------
// App Domain Types
// Union/literal types that align with the Drizzle schema enums.
// ---------------------------------------------------------------------------

export type WorkflowType =
  | "reschedule"
  | "discovery_flight"
  | "next_lesson"
  | "waitlist"
  | "inactivity_outreach"
  | "weather_disruption";

export type TriggerType =
  | "cancellation"
  | "discovery_request"
  | "lesson_complete"
  | "opening_detected"
  | "inactivity_detected"
  | "weather_detected"
  | "manual";

export type TriggerStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export type ProposalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "declined"
  | "expired"
  | "executed"
  | "failed";

export type ProposalActionType = "create_reservation" | "reschedule" | "cancel";

export type ValidationStatus = "pending" | "valid" | "invalid" | "stale";

export type ExecutionStatus = "pending" | "validated" | "created" | "failed";

export type ApprovalDecisionType = "approved" | "declined";

export type CommunicationChannel = "email" | "sms";

export type CommunicationStatus = "pending" | "sent" | "failed" | "bounced";

export type ProspectStatus =
  | "new"
  | "processing"
  | "proposed"
  | "approved"
  | "booked"
  | "cancelled";
