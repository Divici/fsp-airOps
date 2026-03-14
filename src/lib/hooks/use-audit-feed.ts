"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuditEventView } from "@/lib/types/audit-view";
import type { AuditEventType } from "@/lib/types/audit";

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface AuditFeedFilters {
  eventType: AuditEventType | "all";
  dateRange: "all" | "today" | "week";
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const now = new Date();

function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

function summaryForType(eventType: AuditEventType): string {
  const summaries: Record<string, string> = {
    trigger_received: "Cancellation trigger received for reservation R-1042",
    trigger_processed: "Trigger T-301 processed successfully",
    trigger_failed: "Trigger T-302 failed — invalid payload",
    trigger_skipped: "Trigger T-303 skipped — duplicate event",
    proposal_generated: "Reschedule proposal generated for John Smith",
    proposal_expired: "Proposal P-018 expired without review",
    proposal_approved: "Discovery flight proposal approved by dispatcher",
    proposal_declined: "Next lesson proposal declined — instructor unavailable",
    validation_passed: "Reservation validation passed for slot 2 PM Thu",
    validation_failed: "Validation failed — aircraft N12345 has conflict",
    reservation_created: "Reservation created in FSP for Alex Johnson",
    reservation_failed: "Reservation creation failed — FSP API timeout",
    email_sent: "Confirmation email sent to student jane@example.com",
    email_failed: "Email delivery failed — invalid address",
    sms_sent: "SMS reminder sent to +1-555-0123",
    sms_failed: "SMS delivery failed — number unreachable",
  };
  return summaries[eventType] ?? `Event: ${eventType}`;
}

const mockEvents: AuditEventView[] = [
  {
    id: "ae-001",
    operatorId: 1,
    eventType: "trigger_received",
    entityType: "trigger",
    entityId: "T-301",
    summary: summaryForType("trigger_received"),
    details: { triggerType: "cancellation" },
    userId: null,
    createdAt: hoursAgo(0.1),
  },
  {
    id: "ae-002",
    operatorId: 1,
    eventType: "proposal_generated",
    entityType: "proposal",
    entityId: "P-019",
    summary: summaryForType("proposal_generated"),
    details: { workflowType: "reschedule" },
    userId: null,
    createdAt: hoursAgo(0.3),
  },
  {
    id: "ae-003",
    operatorId: 1,
    eventType: "proposal_approved",
    entityType: "proposal",
    entityId: "P-017",
    summary: summaryForType("proposal_approved"),
    details: { userId: "user-001" },
    userId: "user-001",
    createdAt: hoursAgo(0.5),
  },
  {
    id: "ae-004",
    operatorId: 1,
    eventType: "validation_passed",
    entityType: "proposal_action",
    entityId: "PA-042",
    summary: summaryForType("validation_passed"),
    details: null,
    userId: null,
    createdAt: hoursAgo(0.6),
  },
  {
    id: "ae-005",
    operatorId: 1,
    eventType: "reservation_created",
    entityType: "proposal_action",
    entityId: "PA-042",
    summary: summaryForType("reservation_created"),
    details: { fspReservationId: "FSP-8891" },
    userId: null,
    createdAt: hoursAgo(0.7),
  },
  {
    id: "ae-006",
    operatorId: 1,
    eventType: "email_sent",
    entityType: "communication",
    entityId: "COM-101",
    summary: summaryForType("email_sent"),
    details: { recipientAddress: "jane@example.com" },
    userId: null,
    createdAt: hoursAgo(0.8),
  },
  {
    id: "ae-007",
    operatorId: 1,
    eventType: "trigger_processed",
    entityType: "trigger",
    entityId: "T-300",
    summary: summaryForType("trigger_processed"),
    details: { triggerType: "lesson_complete" },
    userId: null,
    createdAt: hoursAgo(1.5),
  },
  {
    id: "ae-008",
    operatorId: 1,
    eventType: "proposal_declined",
    entityType: "proposal",
    entityId: "P-016",
    summary: summaryForType("proposal_declined"),
    details: { userId: "user-002", reason: "instructor unavailable" },
    userId: "user-002",
    createdAt: hoursAgo(2),
  },
  {
    id: "ae-009",
    operatorId: 1,
    eventType: "reservation_failed",
    entityType: "proposal_action",
    entityId: "PA-040",
    summary: summaryForType("reservation_failed"),
    details: { error: "FSP API timeout" },
    userId: null,
    createdAt: hoursAgo(3),
  },
  {
    id: "ae-010",
    operatorId: 1,
    eventType: "proposal_expired",
    entityType: "proposal",
    entityId: "P-015",
    summary: summaryForType("proposal_expired"),
    details: null,
    userId: null,
    createdAt: hoursAgo(5),
  },
  {
    id: "ae-011",
    operatorId: 1,
    eventType: "trigger_skipped",
    entityType: "trigger",
    entityId: "T-298",
    summary: summaryForType("trigger_skipped"),
    details: { reason: "duplicate" },
    userId: null,
    createdAt: hoursAgo(6),
  },
  {
    id: "ae-012",
    operatorId: 1,
    eventType: "validation_failed",
    entityType: "proposal_action",
    entityId: "PA-039",
    summary: summaryForType("validation_failed"),
    details: { reason: "aircraft conflict" },
    userId: null,
    createdAt: hoursAgo(8),
  },
  {
    id: "ae-013",
    operatorId: 1,
    eventType: "sms_sent",
    entityType: "communication",
    entityId: "COM-100",
    summary: summaryForType("sms_sent"),
    details: { recipientAddress: "+1-555-0123" },
    userId: null,
    createdAt: hoursAgo(10),
  },
  {
    id: "ae-014",
    operatorId: 1,
    eventType: "trigger_failed",
    entityType: "trigger",
    entityId: "T-295",
    summary: summaryForType("trigger_failed"),
    details: { error: "invalid payload" },
    userId: null,
    createdAt: hoursAgo(14),
  },
  {
    id: "ae-015",
    operatorId: 1,
    eventType: "email_failed",
    entityType: "communication",
    entityId: "COM-099",
    summary: summaryForType("email_failed"),
    details: { error: "invalid address" },
    userId: null,
    createdAt: hoursAgo(18),
  },
];

// ---------------------------------------------------------------------------
// Fetch function (mock)
// ---------------------------------------------------------------------------

import { isToday, isThisWeek } from "date-fns";

async function fetchAuditFeed(
  filters: AuditFeedFilters
): Promise<AuditEventView[]> {
  await new Promise((r) => setTimeout(r, 300));

  return mockEvents.filter((e) => {
    if (filters.eventType !== "all" && e.eventType !== filters.eventType)
      return false;

    if (filters.dateRange === "today") {
      if (!isToday(new Date(e.createdAt))) return false;
    } else if (filters.dateRange === "week") {
      if (!isThisWeek(new Date(e.createdAt))) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuditFeed(filters: AuditFeedFilters) {
  return useQuery({
    queryKey: ["audit-feed", filters],
    queryFn: () => fetchAuditFeed(filters),
  });
}
