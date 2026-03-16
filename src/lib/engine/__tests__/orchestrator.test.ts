import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "../orchestrator";
import { WorkflowRegistry } from "../workflow-registry";
import { AuditService } from "../audit";
import type { WorkflowHandler } from "../types";
import type { SchedulingTrigger, OperatorSettings } from "@/lib/db/schema";
import type { WorkflowContext, WorkflowResult } from "@/lib/types/workflow";
import type { IFspClient } from "@/lib/fsp-client";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { AUDIT_EVENT_TYPES } from "@/lib/types/audit";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/queries/audit", () => ({
  insertAuditEvent: vi.fn().mockResolvedValue({
    id: "mock-audit-id",
    operatorId: 1,
    eventType: "trigger_received",
    entityId: null,
    entityType: null,
    payload: null,
    createdAt: new Date("2026-01-01"),
  }),
  queryAuditEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
}));

const mockSettings: OperatorSettings = {
  id: "settings-1",
  operatorId: 1,
  timeSinceLastFlightWeight: 1.0,
  timeUntilNextFlightWeight: 1.0,
  totalFlightHoursWeight: 0.5,
  preferSameInstructor: true,
  preferSameInstructorWeight: 0.8,
  preferSameAircraft: false,
  preferSameAircraftWeight: 0.3,
  searchWindowDays: 7,
  topNAlternatives: 5,
  daylightOnly: true,
    inactivityThresholdDays: 7,
  enabledWorkflows: {
    reschedule: true,
    discovery_flight: true,
    next_lesson: true,
    waitlist: true,
  },
  communicationPreferences: { email: true, sms: false },
    communicationTemplates: null,
  checkridePriorityWeight: 2.0,
  autoApprovalEnabled: false,
  autoApprovalThreshold: 0.7,
    weatherMinCeiling: 1000,
    weatherMinVisibility: 3,
    customWeights: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: [] }) },
}));

vi.mock("@/lib/db/queries/proposals", () => ({
  createProposal: vi.fn().mockResolvedValue({
    proposalId: "mock-proposal-id",
    actionIds: [],
  }),
}));

vi.mock("@/lib/db/queries/operator-settings", () => ({
  getOperatorSettings: vi.fn().mockResolvedValue({
    id: "settings-1",
    operatorId: 1,
    timeSinceLastFlightWeight: 1.0,
    timeUntilNextFlightWeight: 1.0,
    totalFlightHoursWeight: 0.5,
    preferSameInstructor: true,
    preferSameInstructorWeight: 0.8,
    preferSameAircraft: false,
    preferSameAircraftWeight: 0.3,
    searchWindowDays: 7,
    topNAlternatives: 5,
    daylightOnly: true,
    inactivityThresholdDays: 7,
    enabledWorkflows: {
      reschedule: true,
      discovery_flight: true,
      next_lesson: true,
      waitlist: true,
    },
    communicationPreferences: { email: true, sms: false },
    communicationTemplates: null,
    checkridePriorityWeight: 2.0,
    autoApprovalEnabled: false,
    autoApprovalThreshold: 0.7,
    weatherMinCeiling: 1000,
    weatherMinVisibility: 3,
    customWeights: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }),
}));

const mockDb = {} as PostgresJsDatabase;
const mockFspClient = {} as IFspClient;

function makeTrigger(
  overrides: Partial<SchedulingTrigger> = {}
): SchedulingTrigger {
  return {
    id: "trigger-1",
    operatorId: 1,
    type: "cancellation",
    status: "pending",
    sourceEntityId: null,
    sourceEntityType: null,
    context: null,
    processedAt: null,
    error: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeMockHandler(
  type: WorkflowHandler["type"],
  result?: Partial<WorkflowResult>
): WorkflowHandler {
  return {
    type,
    execute: vi.fn().mockResolvedValue({
      proposedActions: [],
      summary: `mock ${type} result`,
      rawData: null,
      ...result,
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Orchestrator", () => {
  let registry: WorkflowRegistry;
  let auditService: AuditService;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new WorkflowRegistry();
    auditService = new AuditService(mockDb);
    orchestrator = new Orchestrator(
      mockDb,
      mockFspClient,
      registry,
      auditService
    );
  });

  it("dispatches to the correct workflow handler", async () => {
    const handler = makeMockHandler("reschedule");
    registry.register(handler);

    const trigger = makeTrigger({ type: "cancellation" });
    await orchestrator.executeWorkflow(trigger);

    expect(handler.execute).toHaveBeenCalledTimes(1);
    const ctx = (handler.execute as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as WorkflowContext;
    expect(ctx.operatorId).toBe(1);
    expect(ctx.trigger).toBe(trigger);
    expect(ctx.settings).toEqual(mockSettings);
  });

  it("returns proposal ID on success", async () => {
    registry.register(makeMockHandler("reschedule"));

    const trigger = makeTrigger({ type: "cancellation" });
    const result = await orchestrator.executeWorkflow(trigger);

    expect(result.success).toBe(true);
    expect(result.proposalId).toBeDefined();
    expect(typeof result.proposalId).toBe("string");
    expect(result.triggerId).toBe("trigger-1");
  });

  it("returns error when no workflow mapping exists for trigger type", async () => {
    const trigger = makeTrigger({ type: "manual" });
    const result = await orchestrator.executeWorkflow(trigger);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No workflow mapping for trigger type");
  });

  it("returns error when no handler is registered", async () => {
    // cancellation maps to reschedule, but no handler registered
    const trigger = makeTrigger({ type: "cancellation" });
    const result = await orchestrator.executeWorkflow(trigger);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No handler registered for workflow");
  });

  it("captures workflow execution failure", async () => {
    const handler: WorkflowHandler = {
      type: "reschedule",
      execute: vi.fn().mockRejectedValue(new Error("Slot finder exploded")),
    };
    registry.register(handler);

    const trigger = makeTrigger({ type: "cancellation" });
    const result = await orchestrator.executeWorkflow(trigger);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Slot finder exploded");
  });

  it("logs trigger_received on start", async () => {
    const spy = vi.spyOn(auditService, "logTriggerReceived");
    registry.register(makeMockHandler("reschedule"));

    const trigger = makeTrigger({ type: "cancellation" });
    await orchestrator.executeWorkflow(trigger);

    expect(spy).toHaveBeenCalledWith(1, "trigger-1", "cancellation");
  });

  it("logs proposal_generated on success", async () => {
    const spy = vi.spyOn(auditService, "logProposalGenerated");
    registry.register(makeMockHandler("reschedule"));

    const trigger = makeTrigger({ type: "cancellation" });
    const result = await orchestrator.executeWorkflow(trigger);

    expect(spy).toHaveBeenCalledWith(1, result.proposalId, "reschedule");
  });

  it("logs trigger_failed on error", async () => {
    const spy = vi.spyOn(auditService, "logEvent");

    // No handler registered — will fail
    const trigger = makeTrigger({ type: "cancellation" });
    await orchestrator.executeWorkflow(trigger);

    expect(spy).toHaveBeenCalledWith(
      1,
      AUDIT_EVENT_TYPES.TRIGGER_FAILED,
      expect.objectContaining({
        entityId: "trigger-1",
        entityType: "trigger",
        payload: expect.objectContaining({
          error: expect.stringContaining("No handler registered"),
        }),
      })
    );
  });

  it("loads operator settings and passes them to context", async () => {
    const handler = makeMockHandler("reschedule");
    registry.register(handler);

    const trigger = makeTrigger({ type: "cancellation" });
    await orchestrator.executeWorkflow(trigger);

    const ctx = (handler.execute as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as WorkflowContext;
    expect(ctx.settings).toEqual(mockSettings);
    expect(ctx.settings.searchWindowDays).toBe(7);
  });

  it("handles non-Error throws gracefully", async () => {
    const handler: WorkflowHandler = {
      type: "reschedule",
      execute: vi.fn().mockRejectedValue("string error"),
    };
    registry.register(handler);

    const trigger = makeTrigger({ type: "cancellation" });
    const result = await orchestrator.executeWorkflow(trigger);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
  });
});
