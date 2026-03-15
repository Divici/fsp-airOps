// @vitest-environment node
// ---------------------------------------------------------------------------
// Waitlist End-to-End Integration Tests
// Verifies the full waitlist flow from opening detection through candidate
// finding, ranking, proposal creation, bulk approval, and execution.
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
  proposalId: "proposal-wl-001",
  actionIds: ["action-wl-001", "action-wl-002"],
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
    weatherMinCeiling: 1000,
    weatherMinVisibility: 3,
    customWeights: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }),
}));

const mockCreateTrigger = vi.fn().mockResolvedValue("trigger-wl-001");
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
import { OpeningDetector } from "@/lib/engine/detection/opening-detector";
import { Orchestrator } from "@/lib/engine/orchestrator";
import { WorkflowRegistry } from "@/lib/engine/workflow-registry";
import { AuditService } from "@/lib/engine/audit";
import { WaitlistWorkflowHandler } from "@/lib/engine/workflows/waitlist";
import { ProposalBuilder } from "@/lib/engine/proposal-builder";
import { ReservationExecutor } from "@/lib/engine/execution/reservation-executor";
import { TriggerService } from "@/lib/engine/trigger-service";
import { CandidateFinder } from "@/lib/engine/waitlist/candidate-finder";
import { EligibilityChecker } from "@/lib/engine/waitlist/eligibility-checker";
import { WaitlistRanker } from "@/lib/engine/waitlist/ranker";
import {
  computeTimeSinceLastFlight,
  computeTimeUntilNextFlight,
  computeTotalHours,
  computeInstructorContinuity,
  computeAircraftFamiliarity,
  normalizeSignal,
} from "@/lib/engine/waitlist/signals";
import type { SchedulingTrigger, ProposalAction } from "@/lib/db/schema";
import type { ProposalWithActions } from "@/lib/db/queries/proposals";
import type { FspScheduleResponse } from "@/lib/types/fsp";
import type { WaitlistCandidate, WaitlistWeights } from "@/lib/engine/waitlist/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = {} as any as PostgresJsDatabase;

const OPERATOR_A = 1;
const OPERATOR_B = 2;

function makeWaitlistTrigger(
  overrides: Partial<SchedulingTrigger> = {},
): SchedulingTrigger {
  return {
    id: "trigger-wl-001",
    operatorId: OPERATOR_A,
    type: "opening_detected",
    status: "pending",
    sourceEntityId: null,
    sourceEntityType: null,
    context: {
      openingStart: "2026-03-16T08:00:00",
      openingEnd: "2026-03-16T10:00:00",
      locationId: 1,
      instructorId: "inst-aaa-1111",
      aircraftType: "N12345 - Cessna 172S",
      activityTypeId: "at-1",
    } as unknown as SchedulingTrigger["context"],
    processedAt: null,
    error: null,
    createdAt: new Date("2026-03-13"),
    updatedAt: new Date("2026-03-13"),
    ...overrides,
  };
}

function makeWaitlistAction(
  overrides: Partial<ProposalAction> = {},
): ProposalAction {
  return {
    id: "action-wl-001",
    proposalId: "proposal-wl-001",
    operatorId: OPERATOR_A,
    rank: 1,
    actionType: "create_reservation",
    startTime: new Date("2026-03-16T08:00:00Z"),
    endTime: new Date("2026-03-16T10:00:00Z"),
    locationId: 1,
    studentId: "stu-aaa-1111",
    instructorId: "inst-aaa-1111",
    aircraftId: "ac-1",
    activityTypeId: "at-1",
    trainingContext: null,
    explanation: "Waitlist candidate Alex Rivera (score: 2.5)",
    validationStatus: "pending",
    executionStatus: "pending",
    executionError: null,
    fspReservationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeWaitlistProposal(
  actions: ProposalAction[] = [makeWaitlistAction()],
  overrides: Partial<ProposalWithActions> = {},
): ProposalWithActions {
  return {
    id: "proposal-wl-001",
    operatorId: OPERATOR_A,
    workflowType: "waitlist",
    triggerId: "trigger-wl-001",
    status: "approved",
    priority: 60,
    summary: "Found 2 waitlist candidates for opening",
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

function makeDefaultWeights(): WaitlistWeights {
  return {
    timeSinceLastFlight: 1.0,
    timeUntilNextFlight: 1.0,
    totalHours: 0.5,
    instructorContinuity: 0.8,
    aircraftFamiliarity: 0.3,
  };
}

function makeCandidate(overrides: Partial<WaitlistCandidate> = {}): WaitlistCandidate {
  return {
    studentId: "stu-aaa-1111",
    studentName: "Alex Rivera",
    enrollmentId: "enr-001",
    nextEventId: "evt-001",
    eligibilityScore: 0,
    signals: {
      timeSinceLastFlight: 48,
      timeUntilNextFlight: 72,
      totalHours: 14.5,
      instructorContinuity: 1,
      aircraftFamiliarity: 1,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Waitlist End-to-End Integration", () => {
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
    it("detects opening, finds candidates, ranks them, creates proposal, approves, and executes reservations", async () => {
      const fspClient = new MockFspClient();

      // --- Step 1: Detect an opening ---
      const detector = new OpeningDetector(fspClient);
      const opening = detector.openingFromCancellation(
        1,
        "2026-03-16T08:00:00",
        "2026-03-16T10:00:00",
        "Sarah Chen",
        "N12345 - Cessna 172S",
      );
      expect(opening.source).toBe("cancellation");
      expect(opening.locationId).toBe(1);

      // --- Step 2: Create and dispatch waitlist trigger ---
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const waitlistHandler = new WaitlistWorkflowHandler(fspClient);
      registry.register(waitlistHandler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      const trigger = makeWaitlistTrigger();
      mockGetTriggerById.mockResolvedValue(trigger);

      const dispatchResult = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "opening_detected",
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
        "trigger-wl-001",
      );

      // --- Step 3: Verify proposal was built ---
      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          workflowType: "waitlist",
          triggerId: "trigger-wl-001",
        }),
      );

      const proposalArgs = mockCreateProposal.mock.calls[0][1];
      expect(proposalArgs.actions.length).toBeGreaterThan(0);
      expect(proposalArgs.actions[0].actionType).toBe("create_reservation");

      // --- Step 4: Approve and execute reservation ---
      mockGetProposalById.mockResolvedValue(makeWaitlistProposal());
      const executorFspClient = new MockFspClient();
      vi.spyOn(executorFspClient, "getSchedule").mockResolvedValue(emptySchedule());

      const executor = new ReservationExecutor(mockDb, executorFspClient, auditService, {
        timezoneResolver: () => "America/Los_Angeles",
      });

      const execResult = await executor.executeProposal(OPERATOR_A, "proposal-wl-001");

      expect(execResult.success).toBe(true);
      expect(execResult.results).toHaveLength(1);
      expect(execResult.results[0].fspReservationId).toBeDefined();

      // --- Step 5: Verify final proposal status ---
      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-wl-001",
        "executed",
      );

      // --- Step 6: Verify audit trail ---
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
  // 2. Candidate Ranking
  // =========================================================================

  describe("Candidate Ranking", () => {
    it("ranks candidates by weighted signals with higher time-since-last-flight scoring higher", () => {
      const weights = makeDefaultWeights();
      const ranker = new WaitlistRanker(weights);

      const candidates: WaitlistCandidate[] = [
        makeCandidate({
          studentId: "stu-1",
          studentName: "Alice",
          signals: {
            timeSinceLastFlight: 24, // flew recently
            timeUntilNextFlight: 72,
            totalHours: 14.5,
            instructorContinuity: 1,
            aircraftFamiliarity: 1,
          },
        }),
        makeCandidate({
          studentId: "stu-2",
          studentName: "Bob",
          signals: {
            timeSinceLastFlight: 168, // flew a week ago
            timeUntilNextFlight: 72,
            totalHours: 14.5,
            instructorContinuity: 1,
            aircraftFamiliarity: 1,
          },
        }),
      ];

      const ranked = ranker.rankCandidates(candidates);

      expect(ranked[0].studentId).toBe("stu-2"); // Bob scores higher (longer since last flight)
      expect(ranked[1].studentId).toBe("stu-1");
      expect(ranked[0].eligibilityScore).toBeGreaterThan(ranked[1].eligibilityScore);
    });

    it("different operator weights produce different candidate orderings", () => {
      // Weights that heavily favor instructor continuity
      const instructorWeights: WaitlistWeights = {
        timeSinceLastFlight: 0.1,
        timeUntilNextFlight: 0.1,
        totalHours: 0.1,
        instructorContinuity: 5.0,
        aircraftFamiliarity: 0.1,
      };

      // Weights that heavily favor time since last flight
      const recencyWeights: WaitlistWeights = {
        timeSinceLastFlight: 5.0,
        timeUntilNextFlight: 0.1,
        totalHours: 0.1,
        instructorContinuity: 0.1,
        aircraftFamiliarity: 0.1,
      };

      const candidates: WaitlistCandidate[] = [
        makeCandidate({
          studentId: "stu-1",
          studentName: "Alice",
          signals: {
            timeSinceLastFlight: 168, // long time since last flight
            timeUntilNextFlight: 24,
            totalHours: 10,
            instructorContinuity: 0, // different instructor
            aircraftFamiliarity: 0,
          },
        }),
        makeCandidate({
          studentId: "stu-2",
          studentName: "Bob",
          signals: {
            timeSinceLastFlight: 24, // flew recently
            timeUntilNextFlight: 72,
            totalHours: 20,
            instructorContinuity: 1, // same instructor
            aircraftFamiliarity: 1,
          },
        }),
      ];

      const instructorRanker = new WaitlistRanker(instructorWeights);
      const rankedByInstructor = instructorRanker.rankCandidates(candidates);
      // Bob wins because of instructor continuity
      expect(rankedByInstructor[0].studentId).toBe("stu-2");

      const recencyRanker = new WaitlistRanker(recencyWeights);
      const rankedByRecency = recencyRanker.rankCandidates(candidates);
      // Alice wins because she hasn't flown recently
      expect(rankedByRecency[0].studentId).toBe("stu-1");
    });

    it("normalizes signals to [0, 1] range correctly", () => {
      const ranker = new WaitlistRanker(makeDefaultWeights());

      const candidates: WaitlistCandidate[] = [
        makeCandidate({
          studentId: "stu-1",
          studentName: "Alice",
          signals: {
            timeSinceLastFlight: 0,
            timeUntilNextFlight: 0,
            totalHours: 0,
            instructorContinuity: 0,
            aircraftFamiliarity: 0,
          },
        }),
        makeCandidate({
          studentId: "stu-2",
          studentName: "Bob",
          signals: {
            timeSinceLastFlight: 100,
            timeUntilNextFlight: 100,
            totalHours: 100,
            instructorContinuity: 1,
            aircraftFamiliarity: 1,
          },
        }),
      ];

      const ranked = ranker.rankCandidates(candidates);
      // Bob should have max score, Alice min
      expect(ranked[0].studentId).toBe("stu-2");
      expect(ranked[0].eligibilityScore).toBeGreaterThan(0);
      expect(ranked[1].studentId).toBe("stu-1");
    });

    it("breaks ties deterministically by student name", () => {
      const ranker = new WaitlistRanker(makeDefaultWeights());

      const candidates: WaitlistCandidate[] = [
        makeCandidate({
          studentId: "stu-2",
          studentName: "Zara",
          signals: {
            timeSinceLastFlight: 48,
            timeUntilNextFlight: 72,
            totalHours: 14.5,
            instructorContinuity: 1,
            aircraftFamiliarity: 1,
          },
        }),
        makeCandidate({
          studentId: "stu-1",
          studentName: "Alice",
          signals: {
            timeSinceLastFlight: 48,
            timeUntilNextFlight: 72,
            totalHours: 14.5,
            instructorContinuity: 1,
            aircraftFamiliarity: 1,
          },
        }),
      ];

      const ranked = ranker.rankCandidates(candidates);
      // Same signals = same score, so alphabetical by name
      expect(ranked[0].studentName).toBe("Alice");
      expect(ranked[1].studentName).toBe("Zara");
    });
  });

  // =========================================================================
  // 3. Eligibility Filtering
  // =========================================================================

  describe("Eligibility Filtering", () => {
    it("excludes student with no active enrollment", async () => {
      const fspClient = new MockFspClient();
      // Override getEnrollments to return no active enrollment for stu-xxx
      vi.spyOn(fspClient, "getEnrollments").mockResolvedValue([
        {
          enrollmentId: "enr-expired",
          studentId: "stu-xxx",
          courseId: "crs-ppl",
          courseName: "Private Pilot License",
          startDate: "2025-01-01",
          status: "Completed",
        },
      ]);

      const checker = new EligibilityChecker(fspClient);
      const result = await checker.checkEligibility(
        OPERATOR_A,
        "stu-xxx",
        new Date("2026-03-16T08:00:00"),
        new Date("2026-03-16T10:00:00"),
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("No active enrollment");
    });

    it("excludes student with conflicting reservation", async () => {
      const fspClient = new MockFspClient();
      // stu-aaa-1111 has res-001 at 08:00-10:00 on 2026-03-16
      const checker = new EligibilityChecker(fspClient);
      const result = await checker.checkEligibility(
        OPERATOR_A,
        "stu-aaa-1111",
        new Date("2026-03-16T09:00:00"), // overlaps with res-001
        new Date("2026-03-16T11:00:00"),
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Conflicting reservation");
    });

    it("allows eligible student with active enrollment and no conflict", async () => {
      const fspClient = new MockFspClient();
      // Remove conflicting reservation so student is free
      fspClient.removeReservation("res-001");

      const checker = new EligibilityChecker(fspClient);
      const result = await checker.checkEligibility(
        OPERATOR_A,
        "stu-aaa-1111",
        new Date("2026-03-16T08:00:00"),
        new Date("2026-03-16T10:00:00"),
      );

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("candidate finder excludes students without active enrollment", async () => {
      const fspClient = new MockFspClient();

      // Override getEnrollments to return no active enrollments for any student
      vi.spyOn(fspClient, "getEnrollments").mockResolvedValue([]);

      const finder = new CandidateFinder(fspClient);
      const candidates = await finder.findCandidates(OPERATOR_A, {
        timeWindow: {
          start: new Date("2026-03-16"),
          end: new Date("2026-03-18"),
        },
        locationId: 1,
      });

      expect(candidates).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. Opening Detection
  // =========================================================================

  describe("Opening Detection", () => {
    it("creates opening from cancellation with correct properties", () => {
      const detector = new OpeningDetector(new MockFspClient());
      const opening = detector.openingFromCancellation(
        1,
        "2026-03-16T08:00:00",
        "2026-03-16T10:00:00",
        "Sarah Chen",
        "N12345 - Cessna 172S",
      );

      expect(opening.start).toBe("2026-03-16T08:00:00");
      expect(opening.end).toBe("2026-03-16T10:00:00");
      expect(opening.locationId).toBe(1);
      expect(opening.instructorName).toBe("Sarah Chen");
      expect(opening.aircraftName).toBe("N12345 - Cessna 172S");
      expect(opening.source).toBe("cancellation");
    });

    it("detects schedule gaps via gap analysis", async () => {
      const fspClient = new MockFspClient();
      const detector = new OpeningDetector(fspClient);

      const result = await detector.detect(
        OPERATOR_A,
        { start: "2026-03-16", end: "2026-03-16", locationIds: [1] },
        8,
      );

      // The mock schedule has events for instructors on 2026-03-16,
      // gaps between events should be detected
      expect(result.operatorId).toBe(OPERATOR_A);
      expect(result.openings).toBeDefined();
      // All detected openings should have source "gap_analysis"
      for (const opening of result.openings) {
        expect(opening.source).toBe("gap_analysis");
        expect(opening.locationId).toBe(1);
      }
    });
  });

  // =========================================================================
  // 5. No Eligible Candidates
  // =========================================================================

  describe("No Eligible Candidates", () => {
    it("returns empty result when no candidates match the opening", async () => {
      const fspClient = new MockFspClient();
      // Return no schedulable events
      vi.spyOn(fspClient, "getSchedulableEvents").mockResolvedValue([]);

      const handler = new WaitlistWorkflowHandler(fspClient);
      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger: makeWaitlistTrigger(),
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
      expect(result.summary).toContain("No eligible candidates");
    });

    it("workflow returns no context when trigger context is null", async () => {
      const fspClient = new MockFspClient();
      const handler = new WaitlistWorkflowHandler(fspClient);

      const trigger = makeWaitlistTrigger({ context: null });
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
      expect(result.summary).toContain("No opening context");
    });
  });

  // =========================================================================
  // 6. Bulk Approval
  // =========================================================================

  describe("Bulk Approval", () => {
    it("executes multiple proposals approved in batch", async () => {
      const fspClient = new MockFspClient();
      vi.spyOn(fspClient, "getSchedule").mockResolvedValue(emptySchedule());

      const auditService = new AuditService(mockDb);
      const executor = new ReservationExecutor(mockDb, fspClient, auditService, {
        timezoneResolver: () => "UTC",
      });

      // Proposal 1
      const actions1 = [
        makeWaitlistAction({ id: "action-wl-001", studentId: "stu-aaa-1111" }),
      ];
      const proposal1 = makeWaitlistProposal(actions1, {
        id: "proposal-wl-001",
      });

      // Proposal 2
      const actions2 = [
        makeWaitlistAction({
          id: "action-wl-002",
          proposalId: "proposal-wl-002",
          studentId: "stu-bbb-2222",
          rank: 2,
        }),
      ];
      const proposal2 = makeWaitlistProposal(actions2, {
        id: "proposal-wl-002",
      });

      // Execute both
      mockGetProposalById
        .mockResolvedValueOnce(proposal1)
        .mockResolvedValueOnce(proposal2);

      const result1 = await executor.executeProposal(OPERATOR_A, "proposal-wl-001");
      const result2 = await executor.executeProposal(OPERATOR_A, "proposal-wl-002");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.results[0].fspReservationId).toBeDefined();
      expect(result2.results[0].fspReservationId).toBeDefined();

      // Both proposals should be marked as executed
      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-wl-001",
        "executed",
      );
      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-wl-002",
        "executed",
      );
    });
  });

  // =========================================================================
  // 7. Tenant Isolation
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("candidates and proposals are scoped by operatorId", async () => {
      const builder = new ProposalBuilder(mockDb);

      // Operator A waitlist proposal
      await builder.buildAndPersist({
        operatorId: OPERATOR_A,
        workflowType: "waitlist",
        triggerId: "trigger-wl-a",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date("2026-03-16T08:00:00"),
              endTime: new Date("2026-03-16T10:00:00"),
              locationId: 1,
              studentId: "stu-aaa-1111",
              instructorId: "inst-aaa-1111",
              aircraftId: "ac-1",
            },
          ],
          summary: "Operator A waitlist proposal",
          rawData: null,
        },
      });

      // Operator B waitlist proposal
      await builder.buildAndPersist({
        operatorId: OPERATOR_B,
        workflowType: "waitlist",
        triggerId: "trigger-wl-b",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date("2026-03-16T08:00:00"),
              endTime: new Date("2026-03-16T10:00:00"),
              locationId: 2,
              studentId: "stu-zzz-9999",
            },
          ],
          summary: "Operator B waitlist proposal",
          rawData: null,
        },
      });

      const calls = mockCreateProposal.mock.calls;
      expect(calls[0][1].operatorId).toBe(OPERATOR_A);
      expect(calls[1][1].operatorId).toBe(OPERATOR_B);

      // Verify student IDs are scoped correctly
      expect(calls[0][1].affectedStudentIds).toContain("stu-aaa-1111");
      expect(calls[1][1].affectedStudentIds).toContain("stu-zzz-9999");
    });

    it("triggers for different operators are dispatched independently", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const handler = new WaitlistWorkflowHandler(fspClient);
      registry.register(handler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      // Operator A trigger
      const triggerA = makeWaitlistTrigger({ operatorId: OPERATOR_A });
      mockGetTriggerById.mockResolvedValueOnce(triggerA);

      const resultA = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "opening_detected",
        sourceEntityId: "res-001",
      });

      // Operator B trigger
      const triggerB = makeWaitlistTrigger({
        id: "trigger-wl-002",
        operatorId: OPERATOR_B,
      });
      mockGetTriggerById.mockResolvedValueOnce(triggerB);
      mockCreateTrigger.mockResolvedValueOnce("trigger-wl-002");

      const resultB = await triggerService.createAndDispatch({
        operatorId: OPERATOR_B,
        type: "opening_detected",
        sourceEntityId: "res-002",
      });

      expect(resultA.dispatched).toBe(true);
      expect(resultB.dispatched).toBe(true);

      expect(mockCreateTrigger).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ operatorId: OPERATOR_A }),
      );
      expect(mockCreateTrigger).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ operatorId: OPERATOR_B }),
      );
    });

    it("executor passes operatorId to all DB calls", async () => {
      const fspClient = new MockFspClient();
      vi.spyOn(fspClient, "getSchedule").mockResolvedValue(emptySchedule());

      const auditService = new AuditService(mockDb);
      const executor = new ReservationExecutor(mockDb, fspClient, auditService, {
        timezoneResolver: () => "UTC",
      });

      mockGetProposalById.mockResolvedValue(
        makeWaitlistProposal([makeWaitlistAction()]),
      );

      await executor.executeProposal(OPERATOR_A, "proposal-wl-001");

      for (const call of mockUpdateActionExecutionStatus.mock.calls) {
        expect(call[1]).toBe(OPERATOR_A);
      }

      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-wl-001",
        "executed",
      );
    });
  });

  // =========================================================================
  // 8. Error Handling
  // =========================================================================

  describe("Error Handling", () => {
    it("workflow produces empty result when FSP returns no available slots", async () => {
      const fspClient = new MockFspClient();
      fspClient.setScenario("no_available_slots");

      const handler = new WaitlistWorkflowHandler(fspClient);
      const registry = new WorkflowRegistry();
      registry.register(handler);

      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeWaitlistTrigger();
      const result = await orchestrator.executeWorkflow(trigger);

      // Workflow still succeeds but proposal has no actions
      expect(result.success).toBe(true);

      const proposalArgs = mockCreateProposal.mock.calls[0][1];
      expect(proposalArgs.actions).toHaveLength(0);
    });

    it("stale slot detected during execution marks proposal as failed", async () => {
      const conflictSchedule: FspScheduleResponse = {
        results: {
          events: [
            {
              Start: "2026-03-16T08:00:00Z",
              End: "2026-03-16T10:00:00Z",
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

      mockGetProposalById.mockResolvedValue(
        makeWaitlistProposal([makeWaitlistAction()]),
      );

      const result = await executor.executeProposal(OPERATOR_A, "proposal-wl-001");

      expect(result.success).toBe(false);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain("already booked");

      expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "action-wl-001",
        expect.objectContaining({
          validationStatus: "stale",
          executionStatus: "failed",
        }),
      );

      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-wl-001",
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

      mockGetProposalById.mockResolvedValue(
        makeWaitlistProposal([makeWaitlistAction()]),
      );

      const result = await executor.executeProposal(OPERATOR_A, "proposal-wl-001");

      expect(result.success).toBe(false);
      expect(result.results[0].error).toBe(
        "Aircraft N12345 is under maintenance; Instructor not available",
      );

      expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "action-wl-001",
        expect.objectContaining({
          validationStatus: "invalid",
          executionStatus: "failed",
        }),
      );
    });

    it("handles orchestrator failure when handler throws", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      registry.register({
        type: "waitlist",
        execute: vi.fn().mockRejectedValue(new Error("FSP API timeout")),
      });

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeWaitlistTrigger();
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
  // 9. Signal Computation
  // =========================================================================

  describe("Signal Computation", () => {
    it("computeTimeSinceLastFlight returns hours since most recent past event", () => {
      const schedule: FspScheduleResponse = {
        results: {
          events: [
            {
              Start: "2026-03-14T08:00:00",
              End: "2026-03-14T10:00:00",
              Title: "Lesson",
              CustomerName: "Alex Rivera",
              InstructorName: "Sarah Chen",
              AircraftName: "N12345",
            },
            {
              Start: "2026-03-12T08:00:00",
              End: "2026-03-12T10:00:00",
              Title: "Lesson",
              CustomerName: "Alex Rivera",
              InstructorName: "Sarah Chen",
              AircraftName: "N12345",
            },
          ],
          resources: [],
          unavailability: [],
        },
      };

      const now = new Date("2026-03-16T10:00:00");
      const hours = computeTimeSinceLastFlight(schedule, "Alex Rivera", now);

      // Most recent event ended 2026-03-14T10:00:00, now is 2026-03-16T10:00:00 = 48 hours
      expect(hours).toBe(48);
    });

    it("computeTimeSinceLastFlight returns Infinity when no past events", () => {
      const schedule: FspScheduleResponse = {
        results: { events: [], resources: [], unavailability: [] },
      };

      const hours = computeTimeSinceLastFlight(
        schedule,
        "Nobody",
        new Date("2026-03-16"),
      );
      expect(hours).toBe(Infinity);
    });

    it("computeTimeUntilNextFlight returns hours until next scheduled event", () => {
      const schedule: FspScheduleResponse = {
        results: {
          events: [
            {
              Start: "2026-03-18T08:00:00",
              End: "2026-03-18T10:00:00",
              Title: "Lesson",
              CustomerName: "Alex Rivera",
              InstructorName: "Sarah Chen",
              AircraftName: "N12345",
            },
          ],
          resources: [],
          unavailability: [],
        },
      };

      const now = new Date("2026-03-16T08:00:00");
      const hours = computeTimeUntilNextFlight(schedule, "Alex Rivera", now);

      // Next event starts 2026-03-18T08:00:00, now is 2026-03-16T08:00:00 = 48 hours
      expect(hours).toBe(48);
    });

    it("computeTimeUntilNextFlight returns Infinity when no future events", () => {
      const schedule: FspScheduleResponse = {
        results: { events: [], resources: [], unavailability: [] },
      };

      const hours = computeTimeUntilNextFlight(
        schedule,
        "Nobody",
        new Date("2026-03-16"),
      );
      expect(hours).toBe(Infinity);
    });

    it("computeTotalHours returns the value passed in", () => {
      expect(computeTotalHours(14.5)).toBe(14.5);
      expect(computeTotalHours(0)).toBe(0);
    });

    it("computeInstructorContinuity returns 1 when instructors match", () => {
      expect(computeInstructorContinuity("inst-1", "inst-1")).toBe(1);
    });

    it("computeInstructorContinuity returns 0 when instructors differ", () => {
      expect(computeInstructorContinuity("inst-1", "inst-2")).toBe(0);
    });

    it("computeInstructorContinuity returns 0 when either is undefined", () => {
      expect(computeInstructorContinuity(undefined, "inst-1")).toBe(0);
      expect(computeInstructorContinuity("inst-1", undefined)).toBe(0);
      expect(computeInstructorContinuity(undefined, undefined)).toBe(0);
    });

    it("computeAircraftFamiliarity returns 1 when aircraft in history", () => {
      expect(
        computeAircraftFamiliarity(["N12345", "N67890"], "N12345"),
      ).toBe(1);
    });

    it("computeAircraftFamiliarity returns 0 when aircraft not in history", () => {
      expect(
        computeAircraftFamiliarity(["N12345", "N67890"], "N99999"),
      ).toBe(0);
    });

    it("computeAircraftFamiliarity returns 0 when aircraftId is undefined", () => {
      expect(computeAircraftFamiliarity(["N12345"], undefined)).toBe(0);
    });

    it("normalizeSignal normalizes correctly within range", () => {
      expect(normalizeSignal(50, 0, 100)).toBe(0.5);
      expect(normalizeSignal(0, 0, 100)).toBe(0);
      expect(normalizeSignal(100, 0, 100)).toBe(1);
    });

    it("normalizeSignal clamps values outside range", () => {
      expect(normalizeSignal(-10, 0, 100)).toBe(0);
      expect(normalizeSignal(110, 0, 100)).toBe(1);
    });

    it("normalizeSignal returns 0.5 when min equals max", () => {
      expect(normalizeSignal(50, 50, 50)).toBe(0.5);
    });

    it("normalizeSignal returns 1 for Infinity", () => {
      expect(normalizeSignal(Infinity, 0, 100)).toBe(1);
    });
  });
});
