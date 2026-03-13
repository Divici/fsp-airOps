import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditService } from "@/lib/engine/audit";
import { AUDIT_EVENT_TYPES } from "@/lib/types/audit";
import * as auditQueries from "@/lib/db/queries/audit";

// ---------------------------------------------------------------------------
// Mock the query module
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/queries/audit", () => ({
  insertAuditEvent: vi.fn().mockResolvedValue({
    id: "mock-uuid",
    operatorId: 1,
    eventType: "trigger_received",
    entityId: null,
    entityType: null,
    payload: null,
    createdAt: new Date("2026-01-01"),
  }),
  queryAuditEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
}));

const mockDb = {} as Parameters<typeof auditQueries.insertAuditEvent>[0];

describe("Audit module immutability", () => {
  it("does NOT export update or delete operations from the query module", () => {
    const exportedNames = Object.keys(auditQueries);
    const forbidden = exportedNames.filter(
      (name) =>
        /update/i.test(name) || /delete/i.test(name) || /remove/i.test(name)
    );
    expect(forbidden).toEqual([]);
  });

  it("only exports insertAuditEvent and queryAuditEvents", () => {
    const exportedNames = Object.keys(auditQueries).sort();
    expect(exportedNames).toEqual(["insertAuditEvent", "queryAuditEvents"]);
  });
});

describe("AuditService", () => {
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService(mockDb);
  });

  // -------------------------------------------------------------------------
  // logEvent
  // -------------------------------------------------------------------------

  it("logEvent calls insertAuditEvent with correct parameters", async () => {
    await service.logEvent(1, AUDIT_EVENT_TYPES.TRIGGER_RECEIVED, {
      entityId: "t-1",
      entityType: "trigger",
      payload: { foo: "bar" },
    });

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "trigger_received",
      entityId: "t-1",
      entityType: "trigger",
      payload: { foo: "bar" },
    });
  });

  it("logEvent passes undefined fields as undefined", async () => {
    await service.logEvent(1, AUDIT_EVENT_TYPES.TRIGGER_FAILED);

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "trigger_failed",
      entityId: undefined,
      entityType: undefined,
      payload: undefined,
    });
  });

  // -------------------------------------------------------------------------
  // Convenience methods
  // -------------------------------------------------------------------------

  it("logTriggerReceived passes trigger entity with triggerType payload", async () => {
    await service.logTriggerReceived(1, "t-1", "weather");

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "trigger_received",
      entityId: "t-1",
      entityType: "trigger",
      payload: { triggerType: "weather" },
    });
  });

  it("logProposalGenerated passes proposal entity with workflowType payload", async () => {
    await service.logProposalGenerated(1, "p-1", "cancellation_recovery");

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "proposal_generated",
      entityId: "p-1",
      entityType: "proposal",
      payload: { workflowType: "cancellation_recovery" },
    });
  });

  it("logProposalApproved passes proposal entity with userId payload", async () => {
    await service.logProposalApproved(1, "p-1", "user-42");

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "proposal_approved",
      entityId: "p-1",
      entityType: "proposal",
      payload: { userId: "user-42" },
    });
  });

  it("logProposalDeclined includes reason when provided", async () => {
    await service.logProposalDeclined(1, "p-1", "user-42", "Not suitable");

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "proposal_declined",
      entityId: "p-1",
      entityType: "proposal",
      payload: { userId: "user-42", reason: "Not suitable" },
    });
  });

  it("logProposalDeclined omits reason when not provided", async () => {
    await service.logProposalDeclined(1, "p-1", "user-42");

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "proposal_declined",
      entityId: "p-1",
      entityType: "proposal",
      payload: { userId: "user-42" },
    });
  });

  it("logReservationCreated passes proposal_action entity with fspReservationId", async () => {
    await service.logReservationCreated(1, "pa-1", "fsp-res-99");

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "reservation_created",
      entityId: "pa-1",
      entityType: "proposal_action",
      payload: { fspReservationId: "fsp-res-99" },
    });
  });

  it("logReservationFailed passes proposal_action entity with error", async () => {
    await service.logReservationFailed(1, "pa-1", "Conflict detected");

    expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      eventType: "reservation_failed",
      entityId: "pa-1",
      entityType: "proposal_action",
      payload: { error: "Conflict detected" },
    });
  });

  // -------------------------------------------------------------------------
  // Query helpers
  // -------------------------------------------------------------------------

  it("getEventsForEntity calls queryAuditEvents with entityId filter", async () => {
    await service.getEventsForEntity(1, "t-1", "trigger");

    expect(auditQueries.queryAuditEvents).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      entityId: "t-1",
      entityType: "trigger",
      limit: 1000,
    });
  });

  it("getEventsForEntity works without entityType", async () => {
    await service.getEventsForEntity(1, "t-1");

    expect(auditQueries.queryAuditEvents).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      entityId: "t-1",
      entityType: undefined,
      limit: 1000,
    });
  });

  it("getRecentEvents uses default limit of 50", async () => {
    await service.getRecentEvents(1);

    expect(auditQueries.queryAuditEvents).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      limit: 50,
    });
  });

  it("getRecentEvents uses custom limit", async () => {
    await service.getRecentEvents(1, 10);

    expect(auditQueries.queryAuditEvents).toHaveBeenCalledWith(mockDb, {
      operatorId: 1,
      limit: 10,
    });
  });
});

describe("AUDIT_EVENT_TYPES", () => {
  it("contains all expected event categories", () => {
    // Trigger events
    expect(AUDIT_EVENT_TYPES.TRIGGER_RECEIVED).toBe("trigger_received");
    expect(AUDIT_EVENT_TYPES.TRIGGER_PROCESSED).toBe("trigger_processed");
    expect(AUDIT_EVENT_TYPES.TRIGGER_FAILED).toBe("trigger_failed");
    expect(AUDIT_EVENT_TYPES.TRIGGER_SKIPPED).toBe("trigger_skipped");

    // Proposal events
    expect(AUDIT_EVENT_TYPES.PROPOSAL_GENERATED).toBe("proposal_generated");
    expect(AUDIT_EVENT_TYPES.PROPOSAL_EXPIRED).toBe("proposal_expired");

    // Approval events
    expect(AUDIT_EVENT_TYPES.PROPOSAL_APPROVED).toBe("proposal_approved");
    expect(AUDIT_EVENT_TYPES.PROPOSAL_DECLINED).toBe("proposal_declined");

    // Execution events
    expect(AUDIT_EVENT_TYPES.VALIDATION_PASSED).toBe("validation_passed");
    expect(AUDIT_EVENT_TYPES.VALIDATION_FAILED).toBe("validation_failed");
    expect(AUDIT_EVENT_TYPES.RESERVATION_CREATED).toBe("reservation_created");
    expect(AUDIT_EVENT_TYPES.RESERVATION_FAILED).toBe("reservation_failed");

    // Communication events
    expect(AUDIT_EVENT_TYPES.EMAIL_SENT).toBe("email_sent");
    expect(AUDIT_EVENT_TYPES.EMAIL_FAILED).toBe("email_failed");
    expect(AUDIT_EVENT_TYPES.SMS_SENT).toBe("sms_sent");
    expect(AUDIT_EVENT_TYPES.SMS_FAILED).toBe("sms_failed");
  });

  it("has exactly 16 event types", () => {
    expect(Object.keys(AUDIT_EVENT_TYPES)).toHaveLength(16);
  });
});
