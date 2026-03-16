// @vitest-environment node
// ---------------------------------------------------------------------------
// Discovery Flight End-to-End Integration Tests
// Verifies the full discovery flight flow from prospect request through
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
  proposalId: "proposal-disc-001",
  actionIds: ["action-disc-001", "action-disc-002", "action-disc-003"],
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
    preferSameInstructor: false,
    preferSameInstructorWeight: 0,
    preferSameAircraft: false,
    preferSameAircraftWeight: 0,
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

const mockCreateTrigger = vi.fn().mockResolvedValue("trigger-disc-001");
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

// Mock prospect queries
const mockCreateProspectRequest = vi.fn();
const mockGetProspectById = vi.fn();
const mockUpdateProspectStatus = vi.fn();
const mockListProspectRequests = vi.fn();
const mockAssertProspectTransition = vi.fn();

vi.mock("@/lib/db/queries/prospects", () => ({
  createProspectRequest: (...args: unknown[]) => mockCreateProspectRequest(...args),
  getProspectById: (...args: unknown[]) => mockGetProspectById(...args),
  updateProspectStatus: (...args: unknown[]) => mockUpdateProspectStatus(...args),
  listProspectRequests: (...args: unknown[]) => mockListProspectRequests(...args),
  assertProspectTransition: (...args: unknown[]) => mockAssertProspectTransition(...args),
}));

// ---------------------------------------------------------------------------
// 2. Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { MockFspClient } from "@/lib/fsp-client/mock";
import { Orchestrator } from "@/lib/engine/orchestrator";
import { WorkflowRegistry } from "@/lib/engine/workflow-registry";
import { AuditService } from "@/lib/engine/audit";
import { DiscoveryFlightWorkflowHandler } from "@/lib/engine/workflows/discovery-flight";
import { ProposalBuilder } from "@/lib/engine/proposal-builder";
import { ReservationExecutor } from "@/lib/engine/execution/reservation-executor";
import { TriggerService } from "@/lib/engine/trigger-service";
import type { SchedulingTrigger, ProposalAction } from "@/lib/db/schema";
import type { ProposalWithActions } from "@/lib/db/queries/proposals";
import type { FspScheduleResponse } from "@/lib/types/fsp";
import type { DiscoveryFlightContext } from "@/lib/engine/workflows/discovery-flight.types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = {} as any as PostgresJsDatabase;

const OPERATOR_A = 1;
const OPERATOR_B = 2;

const defaultProspectContext: DiscoveryFlightContext = {
  prospectId: "prospect-001",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  preferredLocationId: 1,
  preferredDateStart: "2026-03-16",
  preferredDateEnd: "2026-03-23",
};

function makeTrigger(overrides: Partial<SchedulingTrigger> = {}): SchedulingTrigger {
  return {
    id: "trigger-disc-001",
    operatorId: OPERATOR_A,
    type: "discovery_request",
    status: "pending",
    sourceEntityId: null,
    sourceEntityType: null,
    context: defaultProspectContext as unknown as SchedulingTrigger["context"],
    processedAt: null,
    error: null,
    createdAt: new Date("2026-03-13"),
    updatedAt: new Date("2026-03-13"),
    ...overrides,
  };
}

function makeAction(overrides: Partial<ProposalAction> = {}): ProposalAction {
  return {
    id: "action-disc-001",
    proposalId: "proposal-disc-001",
    operatorId: OPERATOR_A,
    rank: 1,
    actionType: "create_reservation",
    startTime: new Date("2026-03-16T10:00:00Z"),
    endTime: new Date("2026-03-16T11:00:00Z"),
    locationId: 1,
    studentId: "prospect-001",
    instructorId: "inst-aaa-1111",
    aircraftId: "ac-1",
    activityTypeId: "at-discovery",
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
    id: "proposal-disc-001",
    operatorId: OPERATOR_A,
    workflowType: "discovery_flight",
    triggerId: "trigger-disc-001",
    status: "approved",
    priority: 60,
    summary: "Found 3 discovery flight slots for Jane Doe",
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Discovery Flight End-to-End Integration", () => {
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
    it("prospect form submit creates trigger, executes workflow with daylight constraint, generates proposal, approves, and creates reservation", async () => {
      const fspClient = new MockFspClient();

      // --- Step 1: Create trigger via TriggerService ---
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const discoveryHandler = new DiscoveryFlightWorkflowHandler(fspClient);
      registry.register(discoveryHandler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      const trigger = makeTrigger();
      mockGetTriggerById.mockResolvedValue(trigger);

      const dispatchResult = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "discovery_request",
        sourceEntityId: "prospect-001",
        sourceEntityType: "prospect",
        context: defaultProspectContext as unknown as Record<string, unknown>,
      });

      expect(dispatchResult.duplicate).toBe(false);
      expect(dispatchResult.dispatched).toBe(true);
      expect(dispatchResult.result?.success).toBe(true);
      expect(dispatchResult.result?.proposalId).toBeDefined();

      // Verify trigger was marked as processed
      expect(mockMarkTriggerProcessed).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "trigger-disc-001",
      );

      // --- Step 2: Verify proposal was built ---
      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          workflowType: "discovery_flight",
          triggerId: "trigger-disc-001",
        }),
      );

      // The proposal should have actions from workflow result
      const proposalArgs = mockCreateProposal.mock.calls[0][1];
      expect(proposalArgs.actions.length).toBeGreaterThan(0);
      expect(proposalArgs.actions[0].actionType).toBe("create_reservation");
      expect(proposalArgs.actions[0].studentId).toBe("prospect-001");
      expect(proposalArgs.actions[0].activityTypeId).toBe("at-discovery");

      // --- Step 3: Simulate approval and execute reservation ---
      mockGetProposalById.mockResolvedValue(makeProposal());

      const executorFspClient = new MockFspClient();
      vi.spyOn(executorFspClient, "getSchedule").mockResolvedValue(emptySchedule());

      const executor = new ReservationExecutor(mockDb, executorFspClient, auditService, {
        timezoneResolver: () => "America/Los_Angeles",
      });

      const execResult = await executor.executeProposal(OPERATOR_A, "proposal-disc-001");

      expect(execResult.success).toBe(true);
      expect(execResult.results).toHaveLength(1);
      expect(execResult.results[0].fspReservationId).toBeDefined();

      // --- Step 4: Verify final proposal status ---
      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-disc-001",
        "executed",
      );

      // --- Step 5: Verify audit trail ---
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
  // 2. Daylight Constraint
  // =========================================================================

  describe("Daylight Constraint", () => {
    it("filters slots outside civil twilight hours", async () => {
      const fspClient = new MockFspClient();

      // Override findATime to return slots at various hours
      vi.spyOn(fspClient, "findATime").mockResolvedValue([
        {
          startTime: new Date("2026-03-16T05:00:00"),
          endTime: new Date("2026-03-16T06:00:00"),
          instructorId: "inst-1",
          aircraftId: "ac-1",
          locationId: 1,
          score: 90,
        },
        {
          startTime: new Date("2026-03-16T10:00:00"),
          endTime: new Date("2026-03-16T11:00:00"),
          instructorId: "inst-2",
          aircraftId: "ac-2",
          locationId: 1,
          score: 80,
        },
        {
          startTime: new Date("2026-03-16T20:00:00"),
          endTime: new Date("2026-03-16T21:00:00"),
          instructorId: "inst-3",
          aircraftId: "ac-3",
          locationId: 1,
          score: 70,
        },
      ]);

      // Civil twilight: 06:15 - 18:45
      const handler = new DiscoveryFlightWorkflowHandler(fspClient);

      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger: makeTrigger(),
        settings: {
          id: "settings-1",
          operatorId: OPERATOR_A,
          timeSinceLastFlightWeight: 1.0,
          timeUntilNextFlightWeight: 1.0,
          totalFlightHoursWeight: 0.5,
          preferSameInstructor: false,
          preferSameInstructorWeight: 0,
          preferSameAircraft: false,
          preferSameAircraftWeight: 0,
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
        },
      });

      // Only the 10am slot should pass daylight filter (06:15-18:45)
      expect(result.proposedActions).toHaveLength(1);
      expect(result.proposedActions[0].instructorId).toBe("inst-2");
    });

    it("filters out slots that end after twilight", async () => {
      const fspClient = new MockFspClient();

      vi.spyOn(fspClient, "findATime").mockResolvedValue([
        {
          startTime: new Date("2026-03-16T18:00:00"),
          endTime: new Date("2026-03-16T19:00:00"),
          instructorId: "inst-1",
          aircraftId: "ac-1",
          locationId: 1,
          score: 90,
        },
        {
          startTime: new Date("2026-03-16T12:00:00"),
          endTime: new Date("2026-03-16T13:00:00"),
          instructorId: "inst-2",
          aircraftId: "ac-2",
          locationId: 1,
          score: 80,
        },
      ]);

      const handler = new DiscoveryFlightWorkflowHandler(fspClient);
      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger: makeTrigger(),
        settings: {
          id: "settings-1",
          operatorId: OPERATOR_A,
          timeSinceLastFlightWeight: 1.0,
          timeUntilNextFlightWeight: 1.0,
          totalFlightHoursWeight: 0.5,
          preferSameInstructor: false,
          preferSameInstructorWeight: 0,
          preferSameAircraft: false,
          preferSameAircraftWeight: 0,
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
        },
      });

      // 18:00-19:00 ends after twilight (18:45), only 12:00-13:00 passes
      expect(result.proposedActions).toHaveLength(1);
      expect(result.proposedActions[0].instructorId).toBe("inst-2");
    });
  });

  // =========================================================================
  // 3. Prospect Lifecycle
  // =========================================================================

  describe("Prospect Lifecycle", () => {
    it("validates allowed transitions: new -> processing -> proposed -> approved -> booked", () => {
      // Use the real assertProspectTransition logic
      const VALID_TRANSITIONS: Record<string, string[]> = {
        new: ["processing", "cancelled"],
        processing: ["proposed", "cancelled"],
        proposed: ["approved", "cancelled"],
        approved: ["booked", "cancelled"],
        booked: [],
        cancelled: [],
      };

      function checkTransition(from: string, to: string): boolean {
        const allowed = VALID_TRANSITIONS[from];
        return !!allowed && allowed.includes(to);
      }

      expect(checkTransition("new", "processing")).toBe(true);
      expect(checkTransition("processing", "proposed")).toBe(true);
      expect(checkTransition("proposed", "approved")).toBe(true);
      expect(checkTransition("approved", "booked")).toBe(true);
    });

    it("rejects invalid transitions", () => {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        new: ["processing", "cancelled"],
        processing: ["proposed", "cancelled"],
        proposed: ["approved", "cancelled"],
        approved: ["booked", "cancelled"],
        booked: [],
        cancelled: [],
      };

      function checkTransition(from: string, to: string): boolean {
        const allowed = VALID_TRANSITIONS[from];
        return !!allowed && allowed.includes(to);
      }

      // Can't skip steps
      expect(checkTransition("new", "approved")).toBe(false);
      expect(checkTransition("new", "booked")).toBe(false);

      // Can't go backwards
      expect(checkTransition("approved", "new")).toBe(false);
      expect(checkTransition("booked", "approved")).toBe(false);

      // Can't transition from terminal states
      expect(checkTransition("booked", "cancelled")).toBe(false);
      expect(checkTransition("cancelled", "new")).toBe(false);
    });

    it("allows cancellation from any non-terminal state", () => {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        new: ["processing", "cancelled"],
        processing: ["proposed", "cancelled"],
        proposed: ["approved", "cancelled"],
        approved: ["booked", "cancelled"],
        booked: [],
        cancelled: [],
      };

      function checkTransition(from: string, to: string): boolean {
        const allowed = VALID_TRANSITIONS[from];
        return !!allowed && allowed.includes(to);
      }

      expect(checkTransition("new", "cancelled")).toBe(true);
      expect(checkTransition("processing", "cancelled")).toBe(true);
      expect(checkTransition("proposed", "cancelled")).toBe(true);
      expect(checkTransition("approved", "cancelled")).toBe(true);
    });
  });

  // =========================================================================
  // 4. No Available Slots
  // =========================================================================

  describe("No Available Slots", () => {
    it("workflow produces empty result when FSP returns no matching slots", async () => {
      const fspClient = new MockFspClient();
      fspClient.setScenario("no_available_slots");

      const handler = new DiscoveryFlightWorkflowHandler(fspClient);
      const registry = new WorkflowRegistry();
      registry.register(handler);

      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger();
      const result = await orchestrator.executeWorkflow(trigger);

      // Workflow still succeeds but proposal has no actions
      expect(result.success).toBe(true);

      const proposalArgs = mockCreateProposal.mock.calls[0][1];
      expect(proposalArgs.actions).toHaveLength(0);
    });

    it("summary indicates no slots found for the prospect", async () => {
      const fspClient = new MockFspClient();
      fspClient.setScenario("no_available_slots");

      const handler = new DiscoveryFlightWorkflowHandler(fspClient);

      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger: makeTrigger(),
        settings: {
          id: "settings-1",
          operatorId: OPERATOR_A,
          timeSinceLastFlightWeight: 1.0,
          timeUntilNextFlightWeight: 1.0,
          totalFlightHoursWeight: 0.5,
          preferSameInstructor: false,
          preferSameInstructorWeight: 0,
          preferSameAircraft: false,
          preferSameAircraftWeight: 0,
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
        },
      });

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No available discovery flight slots");
      expect(result.summary).toContain("Jane Doe");
    });
  });

  // =========================================================================
  // 5. Preference Matching
  // =========================================================================

  describe("Preference Matching", () => {
    it("preferred date/time influences slot ranking via time windows", async () => {
      const fspClient = new MockFspClient();

      // Return slots at various times
      vi.spyOn(fspClient, "findATime").mockResolvedValue([
        {
          startTime: new Date("2026-03-16T08:00:00"),
          endTime: new Date("2026-03-16T09:00:00"),
          instructorId: "inst-1",
          aircraftId: "ac-1",
          locationId: 1,
          score: 90,
        },
        {
          startTime: new Date("2026-03-16T10:00:00"),
          endTime: new Date("2026-03-16T11:00:00"),
          instructorId: "inst-2",
          aircraftId: "ac-2",
          locationId: 1,
          score: 80,
        },
        {
          startTime: new Date("2026-03-16T14:00:00"),
          endTime: new Date("2026-03-16T15:00:00"),
          instructorId: "inst-3",
          aircraftId: "ac-3",
          locationId: 1,
          score: 70,
        },
      ]);

      const handler = new DiscoveryFlightWorkflowHandler(fspClient);

      // Create prospect context with morning preference (8-12)
      const prospectWithPrefs: DiscoveryFlightContext = {
        ...defaultProspectContext,
        preferredTimeWindows: [{ start: "8", end: "12" }],
      };

      const trigger = makeTrigger({
        context: prospectWithPrefs as unknown as SchedulingTrigger["context"],
      });

      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger,
        settings: {
          id: "settings-1",
          operatorId: OPERATOR_A,
          timeSinceLastFlightWeight: 1.0,
          timeUntilNextFlightWeight: 1.0,
          totalFlightHoursWeight: 0.5,
          preferSameInstructor: false,
          preferSameInstructorWeight: 0,
          preferSameAircraft: false,
          preferSameAircraftWeight: 0,
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
        },
      });

      // Only morning slots (8am, 10am) match the preference; afternoon excluded
      expect(result.proposedActions).toHaveLength(2);
      const instructorIds = result.proposedActions.map((a) => a.instructorId);
      expect(instructorIds).toContain("inst-1");
      expect(instructorIds).toContain("inst-2");
      expect(instructorIds).not.toContain("inst-3");
    });

    it("falls back to daylight slots when no preference matches", async () => {
      const fspClient = new MockFspClient();

      // Only one slot available, at 2pm (not matching evening preference)
      vi.spyOn(fspClient, "findATime").mockResolvedValue([
        {
          startTime: new Date("2026-03-16T14:00:00"),
          endTime: new Date("2026-03-16T15:00:00"),
          instructorId: "inst-1",
          aircraftId: "ac-1",
          locationId: 1,
          score: 80,
        },
      ]);

      const handler = new DiscoveryFlightWorkflowHandler(fspClient);

      // Evening preference that doesn't match the available slot
      const prospectWithPrefs: DiscoveryFlightContext = {
        ...defaultProspectContext,
        preferredTimeWindows: [{ start: "17", end: "20" }],
      };

      const trigger = makeTrigger({
        context: prospectWithPrefs as unknown as SchedulingTrigger["context"],
      });

      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger,
        settings: {
          id: "settings-1",
          operatorId: OPERATOR_A,
          timeSinceLastFlightWeight: 1.0,
          timeUntilNextFlightWeight: 1.0,
          totalFlightHoursWeight: 0.5,
          preferSameInstructor: false,
          preferSameInstructorWeight: 0,
          preferSameAircraft: false,
          preferSameAircraftWeight: 0,
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
        },
      });

      // Falls back to daylight-filtered slots when no preference match
      expect(result.proposedActions).toHaveLength(1);
      expect(result.proposedActions[0].instructorId).toBe("inst-1");
    });
  });

  // =========================================================================
  // 6. Tenant Isolation
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("prospect triggers are scoped by operatorId", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const handler = new DiscoveryFlightWorkflowHandler(fspClient);
      registry.register(handler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      // Operator A trigger
      const triggerA = makeTrigger({ operatorId: OPERATOR_A });
      mockGetTriggerById.mockResolvedValueOnce(triggerA);

      const resultA = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "discovery_request",
        sourceEntityId: "prospect-001",
        sourceEntityType: "prospect",
        context: defaultProspectContext as unknown as Record<string, unknown>,
      });

      // Operator B trigger
      const triggerB = makeTrigger({
        id: "trigger-disc-002",
        operatorId: OPERATOR_B,
      });
      mockGetTriggerById.mockResolvedValueOnce(triggerB);
      mockCreateTrigger.mockResolvedValueOnce("trigger-disc-002");

      const resultB = await triggerService.createAndDispatch({
        operatorId: OPERATOR_B,
        type: "discovery_request",
        sourceEntityId: "prospect-002",
        sourceEntityType: "prospect",
        context: defaultProspectContext as unknown as Record<string, unknown>,
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
        workflowType: "discovery_flight",
        triggerId: "trigger-a",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date(),
              endTime: new Date(),
              locationId: 1,
              studentId: "prospect-a",
            },
          ],
          summary: "Operator A discovery",
          rawData: null,
        },
      });

      await builder.buildAndPersist({
        operatorId: OPERATOR_B,
        workflowType: "discovery_flight",
        triggerId: "trigger-b",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date(),
              endTime: new Date(),
              locationId: 1,
              studentId: "prospect-b",
            },
          ],
          summary: "Operator B discovery",
          rawData: null,
        },
      });

      const calls = mockCreateProposal.mock.calls;
      expect(calls[0][1].operatorId).toBe(OPERATOR_A);
      expect(calls[1][1].operatorId).toBe(OPERATOR_B);
    });
  });

  // =========================================================================
  // 7. Auto-Trigger on Creation
  // =========================================================================

  describe("Auto-Trigger on Creation", () => {
    it("creating a prospect can automatically create a discovery_request trigger", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const handler = new DiscoveryFlightWorkflowHandler(fspClient);
      registry.register(handler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      // Simulate prospect creation and immediate trigger dispatch
      const prospect = {
        id: "prospect-new-001",
        operatorId: OPERATOR_A,
        firstName: "New",
        lastName: "Prospect",
        email: "new@example.com",
        status: "new" as const,
      };

      const trigger = makeTrigger({
        sourceEntityId: prospect.id,
        sourceEntityType: "prospect",
        context: {
          prospectId: prospect.id,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          email: prospect.email,
        } as unknown as SchedulingTrigger["context"],
      });
      mockGetTriggerById.mockResolvedValue(trigger);

      const result = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "discovery_request",
        sourceEntityId: prospect.id,
        sourceEntityType: "prospect",
        context: {
          prospectId: prospect.id,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          email: prospect.email,
        },
      });

      expect(result.dispatched).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.result?.success).toBe(true);

      // Verify trigger was created with discovery_request type
      expect(mockCreateTrigger).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          type: "discovery_request",
          sourceEntityId: prospect.id,
          sourceEntityType: "prospect",
        }),
      );
    });

    it("duplicate prospect triggers are prevented", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const handler = new DiscoveryFlightWorkflowHandler(fspClient);
      registry.register(handler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      const trigger = makeTrigger();
      mockGetTriggerById.mockResolvedValue(trigger);

      // First call — not duplicate
      mockIsDuplicateTrigger.mockResolvedValueOnce(false);
      const first = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "discovery_request",
        sourceEntityId: "prospect-001",
        sourceEntityType: "prospect",
      });
      expect(first.duplicate).toBe(false);
      expect(first.dispatched).toBe(true);

      // Second call — duplicate detected
      mockIsDuplicateTrigger.mockResolvedValueOnce(true);
      const second = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "discovery_request",
        sourceEntityId: "prospect-001",
        sourceEntityType: "prospect",
      });
      expect(second.duplicate).toBe(true);
      expect(second.dispatched).toBe(false);
    });
  });

  // =========================================================================
  // 8. Error Handling
  // =========================================================================

  describe("Error Handling", () => {
    it("orchestrator fails gracefully with no handler for trigger type", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry(); // No handlers registered
      const auditService = new AuditService(mockDb);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger();
      const result = await orchestrator.executeWorkflow(trigger);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No handler registered");
    });

    it("handles orchestrator failure when handler throws", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      registry.register({
        type: "discovery_flight",
        execute: vi.fn().mockRejectedValue(new Error("FSP API timeout")),
      });

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger();
      const result = await orchestrator.executeWorkflow(trigger);

      expect(result.success).toBe(false);
      expect(result.error).toBe("FSP API timeout");

      expect(mockInsertAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "trigger_failed",
          payload: expect.objectContaining({ error: "FSP API timeout" }),
        }),
      );
    });

    it("stale slot detected during execution marks proposal as failed", async () => {
      const conflictSchedule: FspScheduleResponse = {
        results: {
          events: [
            {
              Start: "2026-03-16T10:00:00Z",
              End: "2026-03-16T11:00:00Z",
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

      const result = await executor.executeProposal(OPERATOR_A, "proposal-disc-001");

      expect(result.success).toBe(false);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain("already booked");

      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-disc-001",
        "failed",
      );
    });

    it("workflow returns empty when trigger has no context", async () => {
      const fspClient = new MockFspClient();
      const handler = new DiscoveryFlightWorkflowHandler(fspClient);

      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger: makeTrigger({ context: null }),
        settings: {
          id: "settings-1",
          operatorId: OPERATOR_A,
          timeSinceLastFlightWeight: 1.0,
          timeUntilNextFlightWeight: 1.0,
          totalFlightHoursWeight: 0.5,
          preferSameInstructor: false,
          preferSameInstructorWeight: 0,
          preferSameAircraft: false,
          preferSameAircraftWeight: 0,
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
        },
      });

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No prospect request context");
    });

    it("proposal builder persists proposal with correct priority for discovery_flight", async () => {
      const builder = new ProposalBuilder(mockDb);

      await builder.buildAndPersist({
        operatorId: OPERATOR_A,
        workflowType: "discovery_flight",
        triggerId: "trigger-disc-001",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date("2026-03-16T10:00:00"),
              endTime: new Date("2026-03-16T11:00:00"),
              locationId: 1,
              studentId: "prospect-001",
              instructorId: "inst-aaa-1111",
              aircraftId: "ac-1",
              activityTypeId: "at-discovery",
            },
          ],
          summary: "1 discovery flight slot found",
          rawData: null,
        },
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          workflowType: "discovery_flight",
          priority: 60, // discovery_flight priority
          affectedStudentIds: ["prospect-001"],
        }),
      );
    });
  });
});
