// @vitest-environment node
// ---------------------------------------------------------------------------
// Final Integration Tests — Task 6.8
// Cross-cutting concerns: multi-workflow dispatch, feature flag gating,
// error propagation, correlation / audit trail, tenant isolation.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// 1. Mock external dependencies
// ---------------------------------------------------------------------------

vi.mock("@/config/env", () => ({
  getEnv: vi.fn().mockReturnValue({ FSP_ENVIRONMENT: "mock" }),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

const mockInsertAuditEvent = vi.fn().mockResolvedValue({
  id: "audit-uuid",
  operatorId: 1,
  eventType: "trigger_received",
  entityId: null,
  entityType: null,
  payload: null,
  createdAt: new Date("2026-03-13"),
});
const mockQueryAuditEvents = vi.fn().mockResolvedValue({ events: [], total: 0 });

vi.mock("@/lib/db/queries/audit", () => ({
  insertAuditEvent: (...args: unknown[]) => mockInsertAuditEvent(...args),
  queryAuditEvents: (...args: unknown[]) => mockQueryAuditEvents(...args),
}));

const mockCreateProposal = vi.fn().mockResolvedValue({
  proposalId: "proposal-final-001",
  actionIds: ["action-final-001"],
});

const mockGetProposalById = vi.fn();
const mockUpdateProposalStatus = vi.fn().mockResolvedValue(undefined);
const mockUpdateActionExecutionStatus = vi.fn().mockResolvedValue(undefined);
const mockListProposals = vi.fn();
const mockExpireStaleProposals = vi.fn();

vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: [] }) },
}));

vi.mock("@/lib/db/queries/proposals", () => ({
  createProposal: (...args: unknown[]) => mockCreateProposal(...args),
  getProposalById: (...args: unknown[]) => mockGetProposalById(...args),
  updateProposalStatus: (...args: unknown[]) => mockUpdateProposalStatus(...args),
  updateActionExecutionStatus: (...args: unknown[]) =>
    mockUpdateActionExecutionStatus(...args),
  listProposals: (...args: unknown[]) => mockListProposals(...args),
  expireStaleProposals: (...args: unknown[]) => mockExpireStaleProposals(...args),
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
    enabledWorkflows: {
      reschedule: true,
      discovery_flight: true,
      next_lesson: true,
      waitlist: true,
    },
    communicationPreferences: { email: true, sms: false },
    communicationTemplates: null,
    autoApprovalEnabled: false,
    autoApprovalThreshold: 0.7,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }),
}));

const mockCreateTrigger = vi.fn().mockResolvedValue("trigger-final-001");
const mockGetTriggerById = vi.fn();
const mockUpdateTriggerStatus = vi.fn().mockResolvedValue(undefined);
const mockIsDuplicateTrigger = vi.fn().mockResolvedValue(false);
const mockMarkTriggerProcessed = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db/queries/triggers", () => ({
  createTrigger: (...args: unknown[]) => mockCreateTrigger(...args),
  getTriggerById: (...args: unknown[]) => mockGetTriggerById(...args),
  updateTriggerStatus: (...args: unknown[]) => mockUpdateTriggerStatus(...args),
  isDuplicateTrigger: (...args: unknown[]) => mockIsDuplicateTrigger(...args),
  markTriggerProcessed: (...args: unknown[]) => mockMarkTriggerProcessed(...args),
}));

const mockAssertTransition = vi.fn();
vi.mock("@/lib/engine/proposal-lifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine/proposal-lifecycle")>();
  return {
    ...actual,
    assertTransition: (...args: unknown[]) => mockAssertTransition(...args),
  };
});

vi.mock("@/lib/db/queries/prospects", () => ({
  createProspectRequest: vi.fn(),
  getProspectById: vi.fn(),
  updateProspectStatus: vi.fn(),
  listProspectRequests: vi.fn(),
  assertProspectTransition: vi.fn(),
}));

// ---------------------------------------------------------------------------
// 2. Imports (after mocks)
// ---------------------------------------------------------------------------

import { MockFspClient } from "@/lib/fsp-client/mock";
import { Orchestrator } from "@/lib/engine/orchestrator";
import { WorkflowRegistry, triggerToWorkflow } from "@/lib/engine/workflow-registry";
import { AuditService } from "@/lib/engine/audit";
import { RescheduleWorkflowHandler } from "@/lib/engine/workflows/reschedule";
import { NextLessonWorkflowHandler } from "@/lib/engine/workflows/next-lesson";
import { DiscoveryFlightWorkflowHandler } from "@/lib/engine/workflows/discovery-flight";
import { WaitlistWorkflowHandler } from "@/lib/engine/workflows/waitlist";
import { TriggerService } from "@/lib/engine/trigger-service";
import { CorrelationContext } from "@/lib/observability/correlation";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { SchedulingTrigger } from "@/lib/db/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = {} as any as PostgresJsDatabase;

const OPERATOR_A = 1;
const OPERATOR_B = 2;

function makeTrigger(overrides: Partial<SchedulingTrigger> = {}): SchedulingTrigger {
  return {
    id: "trigger-final-001",
    operatorId: OPERATOR_A,
    type: "cancellation",
    status: "pending",
    sourceEntityId: null,
    sourceEntityType: null,
    context: {
      reservationId: "res-001",
      studentId: "stu-aaa-1111",
      studentName: "Alex Rivera",
      instructorId: "inst-aaa-1111",
      aircraftId: "ac-1",
      activityTypeId: "at-1",
      locationId: 1,
      originalStart: "2026-03-16T08:00:00",
      originalEnd: "2026-03-16T10:00:00",
      cancellationReason: "Weather",
    } as unknown as SchedulingTrigger["context"],
    processedAt: null,
    error: null,
    createdAt: new Date("2026-03-13"),
    updatedAt: new Date("2026-03-13"),
    ...overrides,
  };
}

function makeDiscoveryTrigger(overrides: Partial<SchedulingTrigger> = {}): SchedulingTrigger {
  return makeTrigger({
    id: "trigger-disc-final-001",
    type: "discovery_request",
    context: {
      prospectId: "prospect-001",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      preferredLocationId: 1,
      preferredDateStart: "2026-03-16",
      preferredDateEnd: "2026-03-23",
    } as unknown as SchedulingTrigger["context"],
    ...overrides,
  });
}

function makeLessonTrigger(overrides: Partial<SchedulingTrigger> = {}): SchedulingTrigger {
  return makeTrigger({
    id: "trigger-nl-final-001",
    type: "lesson_complete",
    context: {
      studentId: "stu-bbb-2222",
      enrollmentId: "enr-001",
      completedEventId: "evt-001",
      completedInstructorId: "inst-aaa-1111",
    } as unknown as SchedulingTrigger["context"],
    ...overrides,
  });
}

function makeWaitlistTrigger(overrides: Partial<SchedulingTrigger> = {}): SchedulingTrigger {
  return makeTrigger({
    id: "trigger-wl-final-001",
    type: "opening_detected",
    context: {
      openingStart: "2026-03-16T10:00:00",
      openingEnd: "2026-03-16T12:00:00",
      locationId: 1,
      instructorId: "inst-aaa-1111",
      aircraftId: "ac-1",
    } as unknown as SchedulingTrigger["context"],
    ...overrides,
  });
}

function buildFullRegistry(fspClient: MockFspClient): WorkflowRegistry {
  const registry = new WorkflowRegistry();
  registry.register(new RescheduleWorkflowHandler(fspClient));
  registry.register(new NextLessonWorkflowHandler(fspClient));
  registry.register(new DiscoveryFlightWorkflowHandler(fspClient));
  registry.register(new WaitlistWorkflowHandler(fspClient));
  return registry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Final Integration — Cross-Cutting Concerns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertTransition.mockImplementation(() => {
      /* pass */
    });
  });

  // =========================================================================
  // 1. Multi-Workflow Orchestration
  // =========================================================================

  describe("Multi-Workflow Orchestration", () => {
    it("dispatches all 4 workflow types through a single orchestrator instance", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      // Reschedule (cancellation trigger)
      const rescheduleResult = await orchestrator.executeWorkflow(makeTrigger());
      expect(rescheduleResult.success).toBe(true);
      expect(rescheduleResult.proposalId).toBeDefined();

      // Discovery flight (discovery_request trigger)
      const discoveryResult = await orchestrator.executeWorkflow(makeDiscoveryTrigger());
      expect(discoveryResult.success).toBe(true);
      expect(discoveryResult.proposalId).toBeDefined();

      // Next lesson (lesson_complete trigger)
      const lessonResult = await orchestrator.executeWorkflow(makeLessonTrigger());
      expect(lessonResult.success).toBe(true);
      expect(lessonResult.proposalId).toBeDefined();

      // Waitlist (opening_detected trigger)
      const waitlistResult = await orchestrator.executeWorkflow(makeWaitlistTrigger());
      expect(waitlistResult.success).toBe(true);
      expect(waitlistResult.proposalId).toBeDefined();

      // All 4 proposals should have been created
      expect(mockCreateProposal).toHaveBeenCalledTimes(4);

      // Each should have the correct workflowType
      const workflowTypes = mockCreateProposal.mock.calls.map(
        (call) => call[1].workflowType,
      );
      expect(workflowTypes).toContain("reschedule");
      expect(workflowTypes).toContain("discovery_flight");
      expect(workflowTypes).toContain("next_lesson");
      expect(workflowTypes).toContain("waitlist");
    });

    it("workflow registry tracks all 4 registered types", () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);

      const types = registry.getRegisteredTypes();
      expect(types).toContain("reschedule");
      expect(types).toContain("discovery_flight");
      expect(types).toContain("next_lesson");
      expect(types).toContain("waitlist");
      expect(types).toHaveLength(4);
    });

    it("triggerToWorkflow maps all trigger types correctly", () => {
      expect(triggerToWorkflow("cancellation")).toBe("reschedule");
      expect(triggerToWorkflow("discovery_request")).toBe("discovery_flight");
      expect(triggerToWorkflow("lesson_complete")).toBe("next_lesson");
      expect(triggerToWorkflow("opening_detected")).toBe("waitlist");
      expect(triggerToWorkflow("manual")).toBeNull();
    });
  });

  // =========================================================================
  // 2. Feature Flag Gating (enabledWorkflows)
  // =========================================================================

  describe("Feature Flag Gating", () => {
    it("orchestrator rejects trigger when no handler is registered for the workflow type", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry(); // empty — no handlers
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger({ type: "cancellation" });
      const result = await orchestrator.executeWorkflow(trigger);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No handler registered");
    });

    it("registry hasHandler returns false for unregistered workflows", () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      registry.register(new RescheduleWorkflowHandler(fspClient));

      expect(registry.hasHandler("reschedule")).toBe(true);
      expect(registry.hasHandler("waitlist")).toBe(false);
      expect(registry.hasHandler("discovery_flight")).toBe(false);
      expect(registry.hasHandler("next_lesson")).toBe(false);
    });

    it("selectively registering handlers gates which workflows run", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      // Only register reschedule
      registry.register(new RescheduleWorkflowHandler(fspClient));
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      // Reschedule works
      const result1 = await orchestrator.executeWorkflow(makeTrigger());
      expect(result1.success).toBe(true);

      // Discovery is gated off
      const result2 = await orchestrator.executeWorkflow(makeDiscoveryTrigger());
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("No handler registered");
    });
  });

  // =========================================================================
  // 3. Error Handling Integration
  // =========================================================================

  describe("Error Handling Integration", () => {
    it("orchestrator catches handler errors and returns structured failure", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      registry.register({
        type: "reschedule",
        execute: vi.fn().mockRejectedValue(new Error("FSP API timeout")),
      });

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const result = await orchestrator.executeWorkflow(makeTrigger());

      expect(result.success).toBe(false);
      expect(result.error).toBe("FSP API timeout");
      expect(result.triggerId).toBe("trigger-final-001");
    });

    it("AppError types flow through orchestrator correctly", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      const appError = new AppError("Slot validation failed", {
        code: ErrorCodes.VALIDATION_ERROR,
        statusCode: 400,
      });

      registry.register({
        type: "reschedule",
        execute: vi.fn().mockRejectedValue(appError),
      });

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const result = await orchestrator.executeWorkflow(makeTrigger());

      expect(result.success).toBe(false);
      expect(result.error).toBe("Slot validation failed");

      // Audit should capture the error message
      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "trigger_failed",
          payload: expect.objectContaining({
            error: "Slot validation failed",
          }),
        }),
      );
    });

    it("error from one workflow does not affect another", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      // Reschedule will fail
      registry.register({
        type: "reschedule",
        execute: vi.fn().mockRejectedValue(new Error("FSP down")),
      });

      // Discovery will succeed
      registry.register(new DiscoveryFlightWorkflowHandler(fspClient));

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const failResult = await orchestrator.executeWorkflow(makeTrigger());
      expect(failResult.success).toBe(false);

      const successResult = await orchestrator.executeWorkflow(makeDiscoveryTrigger());
      expect(successResult.success).toBe(true);
    });

    it("non-Error exceptions are handled gracefully", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      registry.register({
        type: "reschedule",
        execute: vi.fn().mockRejectedValue("string error"),
      });

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const result = await orchestrator.executeWorkflow(makeTrigger());

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  // =========================================================================
  // 4. Observability — Correlation IDs
  // =========================================================================

  describe("Observability — Correlation Context", () => {
    it("CorrelationContext.create generates unique IDs", () => {
      const ctx1 = CorrelationContext.create();
      const ctx2 = CorrelationContext.create();

      expect(ctx1.correlationId).toBeDefined();
      expect(ctx2.correlationId).toBeDefined();
      expect(ctx1.correlationId).not.toBe(ctx2.correlationId);
    });

    it("CorrelationContext.run propagates context through async scope", () => {
      const data = CorrelationContext.create({ operatorId: OPERATOR_A, workflowType: "reschedule" });

      CorrelationContext.run(data, () => {
        const current = CorrelationContext.current();
        expect(current).toBeDefined();
        expect(current?.correlationId).toBe(data.correlationId);
        expect(current?.operatorId).toBe(OPERATOR_A);
        expect(current?.workflowType).toBe("reschedule");
      });
    });

    it("correlation context includes operatorId for multi-tenant tracing", () => {
      const ctxA = CorrelationContext.create({ operatorId: OPERATOR_A });
      const ctxB = CorrelationContext.create({ operatorId: OPERATOR_B });

      expect(ctxA.operatorId).toBe(OPERATOR_A);
      expect(ctxB.operatorId).toBe(OPERATOR_B);
      expect(ctxA.correlationId).not.toBe(ctxB.correlationId);
    });
  });

  // =========================================================================
  // 5. Audit Trail Integration
  // =========================================================================

  describe("Audit Trail Integration", () => {
    it("successful workflow logs trigger_received and proposal_generated", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      await orchestrator.executeWorkflow(makeTrigger());

      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          eventType: "trigger_received",
        }),
      );

      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          eventType: "proposal_generated",
        }),
      );
    });

    it("failed workflow logs trigger_received and trigger_failed", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      registry.register({
        type: "reschedule",
        execute: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      await orchestrator.executeWorkflow(makeTrigger());

      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "trigger_received",
        }),
      );

      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "trigger_failed",
          payload: expect.objectContaining({ error: "timeout" }),
        }),
      );
    });

    it("audit events include operatorId for tenant scoping", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      await orchestrator.executeWorkflow(makeTrigger({ operatorId: OPERATOR_B }));

      // All audit events should carry OPERATOR_B
      for (const call of mockInsertAuditEvent.mock.calls) {
        expect(call[1].operatorId).toBe(OPERATOR_B);
      }
    });

    it("all 4 workflows generate consistent audit events", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      await orchestrator.executeWorkflow(makeTrigger());
      await orchestrator.executeWorkflow(makeDiscoveryTrigger());
      await orchestrator.executeWorkflow(makeLessonTrigger());
      await orchestrator.executeWorkflow(makeWaitlistTrigger());

      // Each workflow should log trigger_received (4 total)
      const triggerReceivedCalls = mockInsertAuditEvent.mock.calls.filter(
        (c) => c[1].eventType === "trigger_received",
      );
      expect(triggerReceivedCalls).toHaveLength(4);

      // Each successful workflow should log proposal_generated (4 total)
      const proposalGeneratedCalls = mockInsertAuditEvent.mock.calls.filter(
        (c) => c[1].eventType === "proposal_generated",
      );
      expect(proposalGeneratedCalls).toHaveLength(4);
    });
  });

  // =========================================================================
  // 6. Cross-Workflow Tenant Isolation
  // =========================================================================

  describe("Cross-Workflow Tenant Isolation", () => {
    it("two operators running different workflows simultaneously produce isolated results", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      // Operator A runs reschedule
      const triggerA = makeTrigger({
        id: "trigger-A",
        operatorId: OPERATOR_A,
        type: "cancellation",
      });

      // Operator B runs discovery
      const triggerB = makeDiscoveryTrigger({
        id: "trigger-B",
        operatorId: OPERATOR_B,
      });

      // Execute both concurrently
      const [resultA, resultB] = await Promise.all([
        orchestrator.executeWorkflow(triggerA),
        orchestrator.executeWorkflow(triggerB),
      ]);

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);

      // Verify proposals were created with correct operator IDs
      const proposalCalls = mockCreateProposal.mock.calls;
      const operatorIds = proposalCalls.map((c) => c[1].operatorId);
      expect(operatorIds).toContain(OPERATOR_A);
      expect(operatorIds).toContain(OPERATOR_B);

      // Verify workflow types are different
      const workflowTypes = proposalCalls.map((c) => c[1].workflowType);
      expect(workflowTypes).toContain("reschedule");
      expect(workflowTypes).toContain("discovery_flight");
    });

    it("trigger service scopes triggers by operator during create-and-dispatch", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      // Operator A
      mockGetTriggerById.mockResolvedValueOnce(makeTrigger({ operatorId: OPERATOR_A }));
      await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "cancellation",
        sourceEntityId: "res-001",
      });

      // Operator B
      mockCreateTrigger.mockResolvedValueOnce("trigger-B-001");
      mockGetTriggerById.mockResolvedValueOnce(
        makeDiscoveryTrigger({ id: "trigger-B-001", operatorId: OPERATOR_B }),
      );
      await triggerService.createAndDispatch({
        operatorId: OPERATOR_B,
        type: "discovery_request",
        sourceEntityId: "prospect-001",
      });

      // createTrigger called with correct operatorIds
      expect(mockCreateTrigger).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ operatorId: OPERATOR_A }),
      );
      expect(mockCreateTrigger).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ operatorId: OPERATOR_B }),
      );

      // markTriggerProcessed called with correct operatorIds
      const processedCalls = mockMarkTriggerProcessed.mock.calls;
      const processedOperators = processedCalls.map((c) => c[1]);
      expect(processedOperators).toContain(OPERATOR_A);
      expect(processedOperators).toContain(OPERATOR_B);
    });

    it("proposals from different operators contain isolated student IDs", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      // Operator A reschedule — trigger has studentId stu-aaa-1111
      await orchestrator.executeWorkflow(
        makeTrigger({ operatorId: OPERATOR_A }),
      );

      // Operator B discovery — trigger has prospectId prospect-001
      await orchestrator.executeWorkflow(
        makeDiscoveryTrigger({ operatorId: OPERATOR_B }),
      );

      const proposalCalls = mockCreateProposal.mock.calls;

      // Operator A proposal should reference student stu-aaa-1111
      const opACall = proposalCalls.find((c) => c[1].operatorId === OPERATOR_A);
      expect(opACall).toBeDefined();
      if (opACall && opACall[1].actions.length > 0) {
        expect(opACall[1].actions[0].studentId).toBe("stu-aaa-1111");
      }

      // Operator B proposal should reference prospect-001
      const opBCall = proposalCalls.find((c) => c[1].operatorId === OPERATOR_B);
      expect(opBCall).toBeDefined();
      if (opBCall && opBCall[1].actions.length > 0) {
        expect(opBCall[1].actions[0].studentId).toBe("prospect-001");
      }
    });
  });

  // =========================================================================
  // 7. Trigger Deduplication Across Workflows
  // =========================================================================

  describe("Trigger Deduplication", () => {
    it("duplicate triggers are rejected regardless of workflow type", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      mockGetTriggerById.mockResolvedValue(makeTrigger());

      // First call succeeds
      mockIsDuplicateTrigger.mockResolvedValueOnce(false);
      const first = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "cancellation",
        sourceEntityId: "res-001",
      });
      expect(first.duplicate).toBe(false);
      expect(first.dispatched).toBe(true);

      // Duplicate
      mockIsDuplicateTrigger.mockResolvedValueOnce(true);
      const second = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "cancellation",
        sourceEntityId: "res-001",
      });
      expect(second.duplicate).toBe(true);
      expect(second.dispatched).toBe(false);
    });
  });

  // =========================================================================
  // 8. Pipeline Consistency
  // =========================================================================

  describe("Pipeline Consistency", () => {
    it("all workflows return triggerId in the result", async () => {
      const fspClient = new MockFspClient();
      const registry = buildFullRegistry(fspClient);
      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const triggers = [
        makeTrigger({ id: "t-1" }),
        makeDiscoveryTrigger({ id: "t-2" }),
        makeLessonTrigger({ id: "t-3" }),
        makeWaitlistTrigger({ id: "t-4" }),
      ];

      for (const trigger of triggers) {
        const result = await orchestrator.executeWorkflow(trigger);
        expect(result.triggerId).toBe(trigger.id);
      }
    });
  });
});
