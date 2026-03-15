// @vitest-environment node
// ---------------------------------------------------------------------------
// Reschedule End-to-End Integration Tests
// Verifies the full reschedule-on-cancellation flow from detection through
// proposal creation, approval, and reservation execution.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// 1. Mock external dependencies (DB, OpenAI, env)
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
  proposalId: "proposal-e2e-001",
  actionIds: ["action-e2e-001", "action-e2e-002", "action-e2e-003"],
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
    inactivityThresholdDays: 7,
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
    weatherMinCeiling: 1000,
    weatherMinVisibility: 3,
    customWeights: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }),
}));

const mockCreateTrigger = vi.fn().mockResolvedValue("trigger-e2e-001");
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

// Mock assertTransition — let it pass by default
const mockAssertTransition = vi.fn();
vi.mock("@/lib/engine/proposal-lifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine/proposal-lifecycle")>();
  return {
    ...actual,
    assertTransition: (...args: unknown[]) => mockAssertTransition(...args),
  };
});

// ---------------------------------------------------------------------------
// 2. Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { MockFspClient } from "@/lib/fsp-client/mock";
import { CancellationDetector } from "@/lib/engine/detection/cancellation-detector";
import { createSnapshot, compareSnapshots } from "@/lib/engine/detection/schedule-snapshot";
import { Orchestrator } from "@/lib/engine/orchestrator";
import { WorkflowRegistry } from "@/lib/engine/workflow-registry";
import { AuditService } from "@/lib/engine/audit";
import { RescheduleWorkflowHandler } from "@/lib/engine/workflows/reschedule";
import { ProposalBuilder } from "@/lib/engine/proposal-builder";
import { ReservationExecutor } from "@/lib/engine/execution/reservation-executor";
import { TriggerService } from "@/lib/engine/trigger-service";
import { ProposalAssembler } from "@/lib/ai/proposal-assembler";
import { validateTransition } from "@/lib/engine/proposal-lifecycle";
import type { SchedulingTrigger, ProposalAction } from "@/lib/db/schema";
import type { ProposalWithActions } from "@/lib/db/queries/proposals";
import type { FspReservationListItem, FspScheduleResponse } from "@/lib/types/fsp";
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
    id: "trigger-e2e-001",
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

function makeAction(overrides: Partial<ProposalAction> = {}): ProposalAction {
  return {
    id: "action-e2e-001",
    proposalId: "proposal-e2e-001",
    operatorId: OPERATOR_A,
    rank: 1,
    actionType: "create_reservation",
    startTime: new Date("2026-03-16T16:00:00Z"),
    endTime: new Date("2026-03-16T18:00:00Z"),
    locationId: 1,
    studentId: "stu-aaa-1111",
    instructorId: "inst-aaa-1111",
    aircraftId: "ac-1",
    activityTypeId: "at-1",
    trainingContext: null,
    explanation: null,
    validationStatus: "pending",
    executionStatus: "pending",
    executionError: null,
    fspReservationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProposal(
  actions: ProposalAction[] = [makeAction()],
  overrides: Partial<ProposalWithActions> = {},
): ProposalWithActions {
  return {
    id: "proposal-e2e-001",
    operatorId: OPERATOR_A,
    workflowType: "reschedule",
    triggerId: "trigger-e2e-001",
    status: "approved",
    priority: 80,
    summary: "3 alternative slots found for Alex Rivera",
    rationale: "Test rationale",
    affectedStudentIds: null,
    affectedReservationIds: null,
    affectedResourceIds: null,
    validationSnapshot: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    actions,
    ...overrides,
  };
}

function emptySchedule(): FspScheduleResponse {
  return { results: { events: [], resources: [], unavailability: [] } };
}

function makeReservationListItem(
  overrides: Partial<FspReservationListItem> = {},
): FspReservationListItem {
  return {
    reservationId: "res-001",
    reservationNumber: 10001,
    resource: "N12345 - Cessna 172S",
    start: "2026-03-16T08:00:00",
    end: "2026-03-16T10:00:00",
    pilotFirstName: "Alex",
    pilotLastName: "Rivera",
    pilotId: "stu-aaa-1111",
    status: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Reschedule End-to-End Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertTransition.mockImplementation(() => {
      /* pass */
    });
  });

  // =========================================================================
  // 1. Full Happy Path
  // =========================================================================

  describe("Full Happy Path", () => {
    it("detects cancellation, creates trigger, executes workflow, builds proposal, approves, and executes reservation", async () => {
      const fspClient = new MockFspClient();

      // --- Step 1: Detect the cancellation ---
      const detector = new CancellationDetector(fspClient);
      const queryParams = { start: "2026-03-16", end: "2026-03-18" };

      // Take a snapshot before cancellation
      const snapshotBefore = await detector.fetchSnapshot(OPERATOR_A, queryParams);
      expect(snapshotBefore.reservations.size).toBeGreaterThan(0);

      // Simulate cancellation
      fspClient.removeReservation("res-001");

      // Detect the cancellation
      const detection = await detector.detect(OPERATOR_A, snapshotBefore, queryParams);
      expect(detection.cancellations).toHaveLength(1);
      expect(detection.cancellations[0].reservationId).toBe("res-001");
      expect(detection.cancellations[0].pilotName).toBe("Alex Rivera");

      // --- Step 2: Create a trigger via TriggerService ---
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const rescheduleHandler = new RescheduleWorkflowHandler(fspClient);
      registry.register(rescheduleHandler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      // Set up mock for getTriggerById to return the trigger
      const trigger = makeTrigger();
      mockGetTriggerById.mockResolvedValue(trigger);

      const dispatchResult = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "cancellation",
        sourceEntityId: "res-001",
        sourceEntityType: "reservation",
        context: trigger.context as unknown as Record<string, unknown>,
      });

      expect(dispatchResult.duplicate).toBe(false);
      expect(dispatchResult.dispatched).toBe(true);
      expect(dispatchResult.result?.success).toBe(true);
      expect(dispatchResult.result?.proposalId).toBeDefined();

      // Verify trigger was marked as processed
      expect(mockMarkTriggerProcessed).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "trigger-e2e-001",
      );

      // --- Step 3: Verify proposal was built ---
      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          workflowType: "reschedule",
          triggerId: "trigger-e2e-001",
        }),
      );

      // The proposal should have actions from workflow result
      const proposalArgs = mockCreateProposal.mock.calls[0][1];
      expect(proposalArgs.actions.length).toBeGreaterThan(0);
      expect(proposalArgs.actions[0].actionType).toBe("create_reservation");
      expect(proposalArgs.actions[0].studentId).toBe("stu-aaa-1111");

      // --- Step 4: Simulate approval and execute reservation ---
      mockGetProposalById.mockResolvedValue(makeProposal());

      // Create a mock FSP client for execution (with getSchedule returning empty)
      const executorFspClient = new MockFspClient();
      // Override getSchedule to return empty (no conflicts)
      vi.spyOn(executorFspClient, "getSchedule").mockResolvedValue(emptySchedule());

      const executor = new ReservationExecutor(mockDb, executorFspClient, auditService, {
        timezoneResolver: () => "America/Los_Angeles",
      });

      const execResult = await executor.executeProposal(OPERATOR_A, "proposal-e2e-001");

      expect(execResult.success).toBe(true);
      expect(execResult.results).toHaveLength(1);
      expect(execResult.results[0].fspReservationId).toBeDefined();

      // --- Step 5: Verify final proposal status ---
      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-e2e-001",
        "executed",
      );

      // --- Step 6: Verify audit trail ---
      // trigger_received is logged by orchestrator
      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          eventType: "trigger_received",
        }),
      );

      // proposal_generated is logged by orchestrator
      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          eventType: "proposal_generated",
        }),
      );

      // reservation_created is logged by executor
      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          eventType: "reservation_created",
        }),
      );
    });
  });

  // =========================================================================
  // 2. Cancellation Detection
  // =========================================================================

  describe("Cancellation Detection", () => {
    it("detects a removed reservation from snapshot comparison", async () => {
      const fspClient = new MockFspClient();
      const detector = new CancellationDetector(fspClient);
      const queryParams = { start: "2026-03-16", end: "2026-03-18" };

      // Capture baseline
      const baseline = await detector.fetchSnapshot(OPERATOR_A, queryParams);
      const initialCount = baseline.reservations.size;
      expect(initialCount).toBeGreaterThan(0);

      // Remove a reservation
      fspClient.removeReservation("res-002");

      // Detect
      const result = await detector.detect(OPERATOR_A, baseline, queryParams);

      expect(result.cancellations).toHaveLength(1);
      expect(result.cancellations[0].reservationId).toBe("res-002");
      expect(result.cancellations[0].pilotName).toBe("Jamie Nguyen");
      expect(result.diff.cancelled).toHaveLength(1);
      expect(result.currentSnapshot.reservations.size).toBe(initialCount - 1);
    });

    it("detects multiple cancellations at once", async () => {
      const fspClient = new MockFspClient();
      const detector = new CancellationDetector(fspClient);
      const queryParams = { start: "2026-03-16", end: "2026-03-18" };

      const baseline = await detector.fetchSnapshot(OPERATOR_A, queryParams);

      fspClient.removeReservation("res-001");
      fspClient.removeReservation("res-003");

      const result = await detector.detect(OPERATOR_A, baseline, queryParams);

      expect(result.cancellations).toHaveLength(2);
      const cancelledIds = result.cancellations.map((c) => c.reservationId);
      expect(cancelledIds).toContain("res-001");
      expect(cancelledIds).toContain("res-003");
    });

    it("returns no cancellations when schedule is unchanged", async () => {
      const fspClient = new MockFspClient();
      const detector = new CancellationDetector(fspClient);
      const queryParams = { start: "2026-03-16", end: "2026-03-18" };

      const baseline = await detector.fetchSnapshot(OPERATOR_A, queryParams);
      const result = await detector.detect(OPERATOR_A, baseline, queryParams);

      expect(result.cancellations).toHaveLength(0);
      expect(result.diff.cancelled).toHaveLength(0);
    });

    it("trigger deduplication prevents duplicate triggers for same cancellation", async () => {
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const fspClient = new MockFspClient();
      const handler = new RescheduleWorkflowHandler(fspClient);
      registry.register(handler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      const trigger = makeTrigger();
      mockGetTriggerById.mockResolvedValue(trigger);

      // First call — not duplicate
      mockIsDuplicateTrigger.mockResolvedValueOnce(false);
      const first = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "cancellation",
        sourceEntityId: "res-001",
        sourceEntityType: "reservation",
      });
      expect(first.duplicate).toBe(false);
      expect(first.dispatched).toBe(true);

      // Second call — duplicate detected
      mockIsDuplicateTrigger.mockResolvedValueOnce(true);
      const second = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "cancellation",
        sourceEntityId: "res-001",
        sourceEntityType: "reservation",
      });
      expect(second.duplicate).toBe(true);
      expect(second.dispatched).toBe(false);
    });

    it("snapshot comparison detects modifications", () => {
      const reservationsBefore: FspReservationListItem[] = [
        makeReservationListItem({
          reservationId: "res-mod-1",
          start: "2026-03-16T08:00:00",
          end: "2026-03-16T10:00:00",
        }),
      ];

      const reservationsAfter: FspReservationListItem[] = [
        makeReservationListItem({
          reservationId: "res-mod-1",
          start: "2026-03-16T10:00:00", // changed time
          end: "2026-03-16T12:00:00",
        }),
      ];

      const snapBefore = createSnapshot(OPERATOR_A, reservationsBefore);
      const snapAfter = createSnapshot(OPERATOR_A, reservationsAfter);

      const diff = compareSnapshots(snapBefore, snapAfter);

      expect(diff.cancelled).toHaveLength(0);
      expect(diff.added).toHaveLength(0);
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].previous.start).toBe("2026-03-16T08:00:00");
      expect(diff.modified[0].current.start).toBe("2026-03-16T10:00:00");
    });
  });

  // =========================================================================
  // 3. Proposal Lifecycle
  // =========================================================================

  describe("Proposal Lifecycle", () => {
    // Use the real validateTransition for lifecycle tests
    it("allows valid transition: pending -> approved -> executed", () => {
      expect(validateTransition("pending", "approved")).toBe(true);
      expect(validateTransition("approved", "executed")).toBe(true);
    });

    it("allows valid transition: pending -> declined", () => {
      expect(validateTransition("pending", "declined")).toBe(true);
    });

    it("allows valid transition: pending -> expired", () => {
      expect(validateTransition("pending", "expired")).toBe(true);
    });

    it("allows valid transition: approved -> failed", () => {
      expect(validateTransition("approved", "failed")).toBe(true);
    });

    it("allows retry: failed -> pending", () => {
      expect(validateTransition("failed", "pending")).toBe(true);
    });

    it("rejects invalid transition: pending -> executed (skipping approved)", () => {
      expect(validateTransition("pending", "executed")).toBe(false);
    });

    it("rejects invalid transition: declined -> approved", () => {
      expect(validateTransition("declined", "approved")).toBe(false);
    });

    it("rejects invalid transition: expired -> pending", () => {
      expect(validateTransition("expired", "pending")).toBe(false);
    });

    it("rejects invalid transition: executed -> pending", () => {
      expect(validateTransition("executed", "pending")).toBe(false);
    });

    it("proposal expiration logic expires stale pending proposals", async () => {
      mockExpireStaleProposals.mockResolvedValue(3);

      const { expireStaleProposals } = await import("@/lib/db/queries/proposals");
      const expiredCount = await expireStaleProposals(mockDb, OPERATOR_A);

      expect(expiredCount).toBe(3);
      expect(mockExpireStaleProposals).toHaveBeenCalledWith(mockDb, OPERATOR_A);
    });

    it("proposal builder persists proposal with correct priority and expiry", async () => {
      const builder = new ProposalBuilder(mockDb);

      await builder.buildAndPersist({
        operatorId: OPERATOR_A,
        workflowType: "reschedule",
        triggerId: "trigger-e2e-001",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date("2026-03-16T10:00:00"),
              endTime: new Date("2026-03-16T12:00:00"),
              locationId: 1,
              studentId: "stu-aaa-1111",
              instructorId: "inst-aaa-1111",
              aircraftId: "ac-1",
              activityTypeId: "at-1",
            },
          ],
          summary: "1 alternative slot found",
          rawData: null,
        },
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          workflowType: "reschedule",
          priority: 80, // reschedule priority
          affectedStudentIds: ["stu-aaa-1111"],
          affectedResourceIds: expect.arrayContaining(["inst-aaa-1111", "ac-1"]),
        }),
      );

      // Verify expiresAt is set (approximately 24 hours from now)
      const args = mockCreateProposal.mock.calls[0][1];
      const expiresAt = args.expiresAt as Date;
      const diffHours =
        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThan(25);
    });
  });

  // =========================================================================
  // 4. Tenant Isolation
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("triggers are scoped to their operator", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const handler = new RescheduleWorkflowHandler(fspClient);
      registry.register(handler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      // Operator A trigger
      const triggerA = makeTrigger({ operatorId: OPERATOR_A });
      mockGetTriggerById.mockResolvedValueOnce(triggerA);

      const resultA = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "cancellation",
        sourceEntityId: "res-001",
      });

      // Operator B trigger
      const triggerB = makeTrigger({
        id: "trigger-e2e-002",
        operatorId: OPERATOR_B,
      });
      mockGetTriggerById.mockResolvedValueOnce(triggerB);
      mockCreateTrigger.mockResolvedValueOnce("trigger-e2e-002");

      const resultB = await triggerService.createAndDispatch({
        operatorId: OPERATOR_B,
        type: "cancellation",
        sourceEntityId: "res-001",
      });

      expect(resultA.dispatched).toBe(true);
      expect(resultB.dispatched).toBe(true);

      // Verify createTrigger was called with different operatorIds
      expect(mockCreateTrigger).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ operatorId: OPERATOR_A }),
      );
      expect(mockCreateTrigger).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ operatorId: OPERATOR_B }),
      );
    });

    it("proposals are scoped to their operator via createProposal", async () => {
      const builder = new ProposalBuilder(mockDb);

      await builder.buildAndPersist({
        operatorId: OPERATOR_A,
        workflowType: "reschedule",
        triggerId: "trigger-a",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date(),
              endTime: new Date(),
              locationId: 1,
              studentId: "stu-1",
            },
          ],
          summary: "Operator A proposal",
          rawData: null,
        },
      });

      await builder.buildAndPersist({
        operatorId: OPERATOR_B,
        workflowType: "reschedule",
        triggerId: "trigger-b",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date(),
              endTime: new Date(),
              locationId: 1,
              studentId: "stu-2",
            },
          ],
          summary: "Operator B proposal",
          rawData: null,
        },
      });

      // Verify each proposal was created with the correct operatorId
      const calls = mockCreateProposal.mock.calls;
      expect(calls[0][1].operatorId).toBe(OPERATOR_A);
      expect(calls[1][1].operatorId).toBe(OPERATOR_B);
    });

    it("executor passes operatorId to all DB and FSP calls", async () => {
      const fspClient = new MockFspClient();
      vi.spyOn(fspClient, "getSchedule").mockResolvedValue(emptySchedule());

      const auditService = new AuditService(mockDb);
      const executor = new ReservationExecutor(mockDb, fspClient, auditService, {
        timezoneResolver: () => "UTC",
      });

      mockGetProposalById.mockResolvedValue(makeProposal([makeAction()]));

      await executor.executeProposal(OPERATOR_A, "proposal-e2e-001");

      // All updateActionExecutionStatus calls should include OPERATOR_A
      for (const call of mockUpdateActionExecutionStatus.mock.calls) {
        expect(call[1]).toBe(OPERATOR_A);
      }

      // updateProposalStatus should include OPERATOR_A
      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-e2e-001",
        "executed",
      );
    });
  });

  // =========================================================================
  // 5. Error Handling
  // =========================================================================

  describe("Error Handling", () => {
    it("workflow produces empty result when FSP returns no available slots", async () => {
      const fspClient = new MockFspClient();
      fspClient.setScenario("no_available_slots");

      const handler = new RescheduleWorkflowHandler(fspClient);
      const registry = new WorkflowRegistry();
      registry.register(handler);

      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger();
      const result = await orchestrator.executeWorkflow(trigger);

      // Workflow still succeeds but proposal has no actions
      expect(result.success).toBe(true);

      // createProposal was called with empty actions
      const proposalArgs = mockCreateProposal.mock.calls[0][1];
      expect(proposalArgs.actions).toHaveLength(0);
    });

    it("stale slot detected during execution marks proposal as failed", async () => {
      const conflictSchedule: FspScheduleResponse = {
        results: {
          events: [
            {
              Start: "2026-03-16T16:00:00Z",
              End: "2026-03-16T18:00:00Z",
              Title: "Conflict",
              CustomerName: "Other Student",
              InstructorName: "inst-aaa-1111",
              AircraftName: "ac-1",
            },
          ],
          resources: [],
          unavailability: [],
        },
      };

      const fspClient = new MockFspClient();
      vi.spyOn(fspClient, "getSchedule").mockResolvedValue(conflictSchedule);

      const auditService = new AuditService(mockDb);
      const executor = new ReservationExecutor(mockDb, fspClient, auditService, {
        timezoneResolver: () => "UTC",
      });

      mockGetProposalById.mockResolvedValue(makeProposal([makeAction()]));

      const result = await executor.executeProposal(OPERATOR_A, "proposal-e2e-001");

      expect(result.success).toBe(false);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain("already booked");

      expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "action-e2e-001",
        expect.objectContaining({
          validationStatus: "stale",
          executionStatus: "failed",
        }),
      );

      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-e2e-001",
        "failed",
      );
    });

    it("FSP validation failure marks proposal as failed with error details", async () => {
      const fspClient = new MockFspClient();
      vi.spyOn(fspClient, "getSchedule").mockResolvedValue(emptySchedule());
      vi.spyOn(fspClient, "validateReservation").mockResolvedValue({
        errors: [
          { message: "Aircraft N12345 is under maintenance", field: "aircraftId" },
          { message: "Instructor not available", field: "instructorId" },
        ],
      });

      const auditService = new AuditService(mockDb);
      const executor = new ReservationExecutor(mockDb, fspClient, auditService, {
        timezoneResolver: () => "UTC",
      });

      mockGetProposalById.mockResolvedValue(makeProposal([makeAction()]));

      const result = await executor.executeProposal(OPERATOR_A, "proposal-e2e-001");

      expect(result.success).toBe(false);
      expect(result.results[0].error).toBe(
        "Aircraft N12345 is under maintenance; Instructor not available",
      );

      expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "action-e2e-001",
        expect.objectContaining({
          validationStatus: "invalid",
          executionStatus: "failed",
        }),
      );

      // Audit logged for validation failure
      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          eventType: "validation_failed",
        }),
      );
    });

    it("handles orchestrator failure when handler throws", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      // Register a handler that throws
      registry.register({
        type: "reschedule",
        execute: vi.fn().mockRejectedValue(new Error("FSP API timeout")),
      });

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger();
      const result = await orchestrator.executeWorkflow(trigger);

      expect(result.success).toBe(false);
      expect(result.error).toBe("FSP API timeout");

      // Audit logged for trigger failure
      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "trigger_failed",
          payload: expect.objectContaining({ error: "FSP API timeout" }),
        }),
      );
    });

    it("executor throws when proposal not found", async () => {
      mockGetProposalById.mockResolvedValue(null);

      const fspClient = new MockFspClient();
      const auditService = new AuditService(mockDb);
      const executor = new ReservationExecutor(mockDb, fspClient, auditService);

      await expect(
        executor.executeProposal(OPERATOR_A, "nonexistent"),
      ).rejects.toThrow("Proposal not found");
    });
  });

  // =========================================================================
  // 6. AI Rationale
  // =========================================================================

  describe("AI Rationale", () => {
    it("generates fallback rationale without AI", () => {
      const assembler = new ProposalAssembler();

      const rationale = assembler.generateFallbackRationale({
        workflowType: "reschedule",
        triggerContext: {
          reservationId: "res-001",
          studentName: "Alex Rivera",
        },
        proposedActions: [
          {
            rank: 1,
            actionType: "create_reservation",
            startTime: new Date("2026-03-16T10:00:00"),
            endTime: new Date("2026-03-16T12:00:00"),
            locationId: 1,
            studentId: "stu-aaa-1111",
            instructorId: "inst-aaa-1111",
          },
          {
            rank: 2,
            actionType: "create_reservation",
            startTime: new Date("2026-03-17T08:00:00"),
            endTime: new Date("2026-03-17T10:00:00"),
            locationId: 1,
            studentId: "stu-aaa-1111",
          },
        ],
        operatorSettings: { searchWindowDays: 7 },
      });

      expect(rationale.summary).toContain("2 options proposed");
      expect(rationale.summary).toContain(
        "Found alternative time slots based on instructor availability",
      );
      expect(rationale.rationale).toBe(rationale.summary);
      expect(rationale.actionExplanations).toHaveLength(2);
      expect(rationale.actionExplanations[0]).toContain("Option 1");
      expect(rationale.actionExplanations[1]).toContain("Option 2");
    });

    it("gracefully falls back when AI call throws", async () => {
      // Mock the OpenAI client to throw
      vi.mock("@/lib/ai/client", () => ({
        getOpenAIClient: vi.fn().mockReturnValue({
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error("API key invalid")),
            },
          },
        }),
        resetOpenAIClient: vi.fn(),
      }));

      const assembler = new ProposalAssembler();

      const rationale = await assembler.generateRationale({
        workflowType: "reschedule",
        triggerContext: { reservationId: "res-001" },
        proposedActions: [
          {
            rank: 1,
            actionType: "create_reservation",
            startTime: new Date("2026-03-16T10:00:00"),
            endTime: new Date("2026-03-16T12:00:00"),
            locationId: 1,
            studentId: "stu-aaa-1111",
          },
        ],
        operatorSettings: {},
      });

      // Should get fallback rationale, not throw
      expect(rationale.summary).toBeDefined();
      expect(rationale.summary.length).toBeGreaterThan(0);
      expect(rationale.actionExplanations).toHaveLength(1);
    });

    it("single action generates singular option text", () => {
      const assembler = new ProposalAssembler();

      const rationale = assembler.generateFallbackRationale({
        workflowType: "reschedule",
        triggerContext: {},
        proposedActions: [
          {
            rank: 1,
            actionType: "create_reservation",
            startTime: new Date("2026-03-16T10:00:00"),
            endTime: new Date("2026-03-16T12:00:00"),
            locationId: 1,
            studentId: "stu-1",
          },
        ],
        operatorSettings: {},
      });

      expect(rationale.summary).toContain("1 option proposed");
    });
  });

  // =========================================================================
  // 7. Orchestrator + Workflow Integration
  // =========================================================================

  describe("Orchestrator + Workflow Integration", () => {
    it("orchestrator correctly routes cancellation trigger to reschedule handler", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const handler = new RescheduleWorkflowHandler(fspClient);
      registry.register(handler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger();
      const result = await orchestrator.executeWorkflow(trigger);

      expect(result.success).toBe(true);
      expect(result.proposalId).toBeDefined();
      expect(result.triggerId).toBe("trigger-e2e-001");
    });

    it("orchestrator fails gracefully with no handler for trigger type", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger({ type: "cancellation" }); // no handler registered
      const result = await orchestrator.executeWorkflow(trigger);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No handler registered");
    });

    it("reschedule workflow respects topNAlternatives setting", async () => {
      const fspClient = new MockFspClient();
      const handler = new RescheduleWorkflowHandler(fspClient);

      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger: makeTrigger(),
        settings: {
          id: "settings-1",
          operatorId: OPERATOR_A,
          timeSinceLastFlightWeight: 1.0,
          timeUntilNextFlightWeight: 1.0,
          totalFlightHoursWeight: 0.5,
          preferSameInstructor: true,
          preferSameInstructorWeight: 0.8,
          preferSameAircraft: false,
          preferSameAircraftWeight: 0.3,
          searchWindowDays: 7,
          topNAlternatives: 2,
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
          autoApprovalEnabled: false,
          autoApprovalThreshold: 0.7,
    weatherMinCeiling: 1000,
    weatherMinVisibility: 3,
    customWeights: [],
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      });

      expect(result.proposedActions).toHaveLength(2);
      expect(result.proposedActions[0].rank).toBe(1);
      expect(result.proposedActions[1].rank).toBe(2);
    });

    it("reschedule workflow returns empty when trigger has no context", async () => {
      const fspClient = new MockFspClient();
      const handler = new RescheduleWorkflowHandler(fspClient);

      const trigger = makeTrigger({ context: null });
      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger,
        settings: {
          id: "settings-1",
          operatorId: OPERATOR_A,
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
          autoApprovalEnabled: false,
          autoApprovalThreshold: 0.7,
    weatherMinCeiling: 1000,
    weatherMinVisibility: 3,
    customWeights: [],
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      });

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No cancelled reservation context");
    });
  });
});
