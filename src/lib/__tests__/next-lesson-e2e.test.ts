// @vitest-environment node
// ---------------------------------------------------------------------------
// Next Lesson End-to-End Integration Tests
// Verifies the full next-lesson flow from lesson completion detection through
// enrollment resolution, proposal creation, approval, and reservation execution.
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
  proposalId: "proposal-nl-001",
  actionIds: ["action-nl-001", "action-nl-002", "action-nl-003"],
});

const mockGetProposalById = vi.fn();
const mockUpdateProposalStatus = vi.fn().mockResolvedValue(undefined);
const mockUpdateActionExecutionStatus = vi.fn().mockResolvedValue(undefined);
const mockListProposals = vi.fn();
const mockExpireStaleProposals = vi.fn();

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
    autoApprovalEnabled: false,
    autoApprovalThreshold: 0.7,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }),
}));

const mockCreateTrigger = vi.fn().mockResolvedValue("trigger-nl-001");
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
import {
  LessonCompletionDetector,
  createLessonSnapshot,
  compareLessonSnapshots,
} from "@/lib/engine/detection/lesson-completion-detector";
import { NextLessonResolver } from "@/lib/engine/training/next-lesson-resolver";
import { Orchestrator } from "@/lib/engine/orchestrator";
import { WorkflowRegistry } from "@/lib/engine/workflow-registry";
import { AuditService } from "@/lib/engine/audit";
import { NextLessonWorkflowHandler } from "@/lib/engine/workflows/next-lesson";
import { ProposalBuilder } from "@/lib/engine/proposal-builder";
import { ReservationExecutor } from "@/lib/engine/execution/reservation-executor";
import { TriggerService } from "@/lib/engine/trigger-service";
import type { SchedulingTrigger, ProposalAction } from "@/lib/db/schema";
import type { ProposalWithActions } from "@/lib/db/queries/proposals";
import type {
  FspScheduleResponse,
  FspSchedulableEvent,
} from "@/lib/types/fsp";
import type { NextLessonWorkflowContext } from "@/lib/engine/workflows/next-lesson.types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = {} as any as PostgresJsDatabase;

const OPERATOR_A = 1;
const OPERATOR_B = 2;
const STUDENT_ID = "stu-aaa-1111";
const ENROLLMENT_ID = "enr-001";

const defaultTriggerContext: NextLessonWorkflowContext = {
  studentId: STUDENT_ID,
  enrollmentId: ENROLLMENT_ID,
  completedEventId: "evt-007",
  completedInstructorId: "inst-aaa-1111",
};

function makeTrigger(overrides: Partial<SchedulingTrigger> = {}): SchedulingTrigger {
  return {
    id: "trigger-nl-001",
    operatorId: OPERATOR_A,
    type: "lesson_complete",
    status: "pending",
    sourceEntityId: null,
    sourceEntityType: null,
    context: defaultTriggerContext as unknown as SchedulingTrigger["context"],
    processedAt: null,
    error: null,
    createdAt: new Date("2026-03-13"),
    updatedAt: new Date("2026-03-13"),
    ...overrides,
  };
}

function makeAction(overrides: Partial<ProposalAction> = {}): ProposalAction {
  return {
    id: "action-nl-001",
    proposalId: "proposal-nl-001",
    operatorId: OPERATOR_A,
    rank: 1,
    actionType: "create_reservation",
    startTime: new Date("2026-03-17T10:00:00Z"),
    endTime: new Date("2026-03-17T12:00:00Z"),
    locationId: 1,
    studentId: STUDENT_ID,
    instructorId: "inst-aaa-1111",
    aircraftId: "ac-1",
    activityTypeId: "at-1",
    trainingContext: {
      enrollmentId: ENROLLMENT_ID,
      lessonId: "les-ppl-08",
      lessonName: "PPL Lesson 8 - Slow Flight & Stalls",
      lessonOrder: 8,
      courseName: "Private Pilot License",
    },
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
    id: "proposal-nl-001",
    operatorId: OPERATOR_A,
    workflowType: "next_lesson",
    triggerId: "trigger-nl-001",
    status: "approved",
    priority: 40,
    summary: "Found 3 slots for PPL Lesson 8",
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

describe("Next Lesson End-to-End Integration", () => {
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
    it("lesson completion detected, next lesson resolved, workflow executes, proposal generated, approved, reservation created", async () => {
      const fspClient = new MockFspClient();

      // --- Step 1: Detect lesson completion ---
      const detector = new LessonCompletionDetector(fspClient);
      const queryParams = {
        startDate: "2026-03-16",
        endDate: "2027-03-16",
        locationId: 1,
      };

      // Take baseline snapshot
      const baseline = await detector.fetchSnapshot(OPERATOR_A, queryParams);
      expect(baseline.events.size).toBeGreaterThan(0);

      // Simulate lesson completion by removing an event from mock data
      // Override getSchedulableEvents to return fewer events
      const completedEvent = [...baseline.events.values()][0];
      const remainingEvents = [...baseline.events.values()].filter(
        (e) => e.eventId !== completedEvent.eventId,
      );
      vi.spyOn(fspClient, "getSchedulableEvents").mockResolvedValue(remainingEvents);

      const detection = await detector.detect(OPERATOR_A, baseline, queryParams);
      expect(detection.completions).toHaveLength(1);
      expect(detection.completions[0].eventId).toBe(completedEvent.eventId);

      // --- Step 2: Create trigger and dispatch ---
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const nextLessonHandler = new NextLessonWorkflowHandler(fspClient);
      registry.register(nextLessonHandler);

      // Reset getSchedulableEvents for workflow execution (resolver needs it)
      vi.spyOn(fspClient, "getSchedulableEvents").mockRestore();

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      const trigger = makeTrigger();
      mockGetTriggerById.mockResolvedValue(trigger);

      const dispatchResult = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "lesson_complete",
        sourceEntityId: completedEvent.eventId,
        sourceEntityType: "schedulable_event",
        context: defaultTriggerContext as unknown as Record<string, unknown>,
      });

      expect(dispatchResult.duplicate).toBe(false);
      expect(dispatchResult.dispatched).toBe(true);
      expect(dispatchResult.result?.success).toBe(true);
      expect(dispatchResult.result?.proposalId).toBeDefined();

      // Verify trigger was marked as processed
      expect(mockMarkTriggerProcessed).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "trigger-nl-001",
      );

      // --- Step 3: Verify proposal was built ---
      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          workflowType: "next_lesson",
          triggerId: "trigger-nl-001",
        }),
      );

      const proposalArgs = mockCreateProposal.mock.calls[0][1];
      expect(proposalArgs.actions.length).toBeGreaterThan(0);
      expect(proposalArgs.actions[0].actionType).toBe("create_reservation");
      expect(proposalArgs.actions[0].studentId).toBe(STUDENT_ID);
      expect(proposalArgs.actions[0].trainingContext).toBeDefined();

      // --- Step 4: Approve and execute ---
      mockGetProposalById.mockResolvedValue(makeProposal());

      const executorFspClient = new MockFspClient();
      vi.spyOn(executorFspClient, "getSchedule").mockResolvedValue(emptySchedule());

      const executor = new ReservationExecutor(mockDb, executorFspClient, auditService, {
        timezoneResolver: () => "America/Los_Angeles",
      });

      const execResult = await executor.executeProposal(OPERATOR_A, "proposal-nl-001");

      expect(execResult.success).toBe(true);
      expect(execResult.results).toHaveLength(1);
      expect(execResult.results[0].fspReservationId).toBeDefined();

      // --- Step 5: Verify final status ---
      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-nl-001",
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
  // 2. Enrollment Resolution
  // =========================================================================

  describe("Enrollment Resolution", () => {
    it("resolves correct next event from enrollment progress", async () => {
      const fspClient = new MockFspClient();
      const resolver = new NextLessonResolver(fspClient);

      const result = await resolver.getNextLesson(
        OPERATOR_A,
        STUDENT_ID,
        ENROLLMENT_ID,
      );

      expect(result).not.toBeNull();
      expect(result!.nextEvent.enrollmentId).toBe(ENROLLMENT_ID);
      expect(result!.nextEvent.studentId).toBe(STUDENT_ID);
      // Should return the lowest lessonOrder event for this enrollment
      expect(result!.nextEvent.lessonName).toContain("PPL Lesson 8");
    });

    it("returns null when enrollment not found", async () => {
      const fspClient = new MockFspClient();
      const resolver = new NextLessonResolver(fspClient);

      const result = await resolver.getNextLesson(
        OPERATOR_A,
        STUDENT_ID,
        "nonexistent-enrollment",
      );

      expect(result).toBeNull();
    });

    it("returns null when enrollment is inactive", async () => {
      const fspClient = new MockFspClient();

      // Override enrollments to return an inactive enrollment
      vi.spyOn(fspClient, "getEnrollments").mockResolvedValue([
        {
          enrollmentId: ENROLLMENT_ID,
          studentId: STUDENT_ID,
          courseId: "crs-ppl",
          courseName: "Private Pilot License",
          startDate: "2025-11-01",
          status: "Completed",
        },
      ]);

      const resolver = new NextLessonResolver(fspClient);
      const result = await resolver.getNextLesson(
        OPERATOR_A,
        STUDENT_ID,
        ENROLLMENT_ID,
      );

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // 3. All Lessons Complete
  // =========================================================================

  describe("All Lessons Complete", () => {
    it("workflow returns empty when no next lesson available", async () => {
      const fspClient = new MockFspClient();

      // Override to return no schedulable events for this enrollment
      vi.spyOn(fspClient, "getSchedulableEvents").mockResolvedValue([]);

      const handler = new NextLessonWorkflowHandler(fspClient);

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
          topNAlternatives: 5,
          daylightOnly: true,
          enabledWorkflows: {
            reschedule: true,
            discovery_flight: true,
            next_lesson: true,
            waitlist: true,
          },
          communicationPreferences: { email: true, sms: false },
          autoApprovalEnabled: false,
          autoApprovalThreshold: 0.7,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      });

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No next lesson available");
    });

    it("orchestrator produces empty-action proposal when all lessons done", async () => {
      const fspClient = new MockFspClient();
      vi.spyOn(fspClient, "getSchedulableEvents").mockResolvedValue([]);

      const handler = new NextLessonWorkflowHandler(fspClient);
      const registry = new WorkflowRegistry();
      registry.register(handler);

      const auditService = new AuditService(mockDb);
      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);

      const trigger = makeTrigger();
      const result = await orchestrator.executeWorkflow(trigger);

      expect(result.success).toBe(true);

      const proposalArgs = mockCreateProposal.mock.calls[0][1];
      expect(proposalArgs.actions).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. Instructor Continuity
  // =========================================================================

  describe("Instructor Continuity", () => {
    it("same instructor gets ranking bonus in slot selection", async () => {
      const fspClient = new MockFspClient();

      // Return slots with different instructors
      vi.spyOn(fspClient, "findATime").mockResolvedValue([
        {
          startTime: new Date("2026-03-16T10:00:00"),
          endTime: new Date("2026-03-16T12:00:00"),
          instructorId: "inst-other",
          aircraftId: "ac-1",
          locationId: 1,
          score: 80,
        },
        {
          startTime: new Date("2026-03-17T10:00:00"),
          endTime: new Date("2026-03-17T12:00:00"),
          instructorId: "inst-aaa-1111", // same as completed instructor
          aircraftId: "ac-1",
          locationId: 1,
          score: 50, // lower base score
        },
      ]);

      const handler = new NextLessonWorkflowHandler(fspClient);

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
          topNAlternatives: 5,
          daylightOnly: true,
          enabledWorkflows: {
            reschedule: true,
            discovery_flight: true,
            next_lesson: true,
            waitlist: true,
          },
          communicationPreferences: { email: true, sms: false },
          autoApprovalEnabled: false,
          autoApprovalThreshold: 0.7,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      });

      // Same instructor should rank higher despite lower base score
      expect(result.proposedActions[0].instructorId).toBe("inst-aaa-1111");
    });

    it("includes training context in proposal actions", async () => {
      const fspClient = new MockFspClient();
      const handler = new NextLessonWorkflowHandler(fspClient);

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
          topNAlternatives: 3,
          daylightOnly: true,
          enabledWorkflows: {
            reschedule: true,
            discovery_flight: true,
            next_lesson: true,
            waitlist: true,
          },
          communicationPreferences: { email: true, sms: false },
          autoApprovalEnabled: false,
          autoApprovalThreshold: 0.7,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      });

      expect(result.proposedActions.length).toBeGreaterThan(0);
      const action = result.proposedActions[0];
      expect(action.trainingContext).toBeDefined();
      expect(action.trainingContext!.enrollmentId).toBe(ENROLLMENT_ID);
      expect(action.trainingContext!.lessonId).toBe("les-ppl-08");
      expect(action.trainingContext!.lessonName).toContain("PPL Lesson 8");
      expect(action.trainingContext!.courseName).toBe("Private Pilot License");
    });
  });

  // =========================================================================
  // 5. Lesson Completion Detection
  // =========================================================================

  describe("Lesson Completion Detection", () => {
    it("detector correctly identifies completed events via snapshot comparison", async () => {
      const fspClient = new MockFspClient();
      const detector = new LessonCompletionDetector(fspClient);
      const queryParams = {
        startDate: "2026-03-16",
        endDate: "2027-03-16",
        locationId: 1,
      };

      // Take baseline snapshot
      const baseline = await detector.fetchSnapshot(OPERATOR_A, queryParams);
      const initialCount = baseline.events.size;
      expect(initialCount).toBeGreaterThan(0);

      // Simulate one event completed (removed from schedulable list)
      const allEvents = [...baseline.events.values()];
      const completedEvent = allEvents[0];
      const remainingEvents = allEvents.slice(1);

      vi.spyOn(fspClient, "getSchedulableEvents").mockResolvedValue(remainingEvents);

      const result = await detector.detect(OPERATOR_A, baseline, queryParams);

      expect(result.completions).toHaveLength(1);
      expect(result.completions[0].eventId).toBe(completedEvent.eventId);
      expect(result.completions[0].studentId).toBe(completedEvent.studentId);
      expect(result.currentSnapshot.events.size).toBe(initialCount - 1);
    });

    it("snapshot comparison functions work correctly", () => {
      const eventsBefore: FspSchedulableEvent[] = [
        {
          eventId: "evt-A",
          enrollmentId: "enr-001",
          studentId: "stu-001",
          studentFirstName: "Test",
          studentLastName: "Student",
          courseId: "crs-1",
          courseName: "Course 1",
          lessonId: "les-1",
          lessonName: "Lesson 1",
          lessonOrder: 1,
          flightType: 0,
          routeType: 0,
          timeOfDay: 0,
          durationTotal: 120,
          aircraftDurationTotal: 90,
          instructorDurationPre: 15,
          instructorDurationPost: 15,
          instructorDurationTotal: 120,
          instructorRequired: true,
          instructorIds: ["inst-1"],
          aircraftIds: ["ac-1"],
          schedulingGroupIds: [],
          meetingRoomIds: [],
          isStageCheck: false,
          reservationTypeId: "rt-1",
          activityTypeId: "at-1",
        },
        {
          eventId: "evt-B",
          enrollmentId: "enr-001",
          studentId: "stu-001",
          studentFirstName: "Test",
          studentLastName: "Student",
          courseId: "crs-1",
          courseName: "Course 1",
          lessonId: "les-2",
          lessonName: "Lesson 2",
          lessonOrder: 2,
          flightType: 0,
          routeType: 0,
          timeOfDay: 0,
          durationTotal: 120,
          aircraftDurationTotal: 90,
          instructorDurationPre: 15,
          instructorDurationPost: 15,
          instructorDurationTotal: 120,
          instructorRequired: true,
          instructorIds: ["inst-1"],
          aircraftIds: ["ac-1"],
          schedulingGroupIds: [],
          meetingRoomIds: [],
          isStageCheck: false,
          reservationTypeId: "rt-1",
          activityTypeId: "at-1",
        },
      ];

      // After completion, evt-A is gone
      const eventsAfter = [eventsBefore[1]];

      const snapBefore = createLessonSnapshot(OPERATOR_A, eventsBefore);
      const snapAfter = createLessonSnapshot(OPERATOR_A, eventsAfter);

      const completions = compareLessonSnapshots(snapBefore, snapAfter);

      expect(completions).toHaveLength(1);
      expect(completions[0].eventId).toBe("evt-A");
      expect(completions[0].lessonName).toBe("Lesson 1");
      expect(completions[0].studentName).toBe("Test Student");
    });

    it("returns no completions when schedule is unchanged", async () => {
      const fspClient = new MockFspClient();
      const detector = new LessonCompletionDetector(fspClient);
      const queryParams = {
        startDate: "2026-03-16",
        endDate: "2027-03-16",
        locationId: 1,
      };

      const baseline = await detector.fetchSnapshot(OPERATOR_A, queryParams);
      const result = await detector.detect(OPERATOR_A, baseline, queryParams);

      expect(result.completions).toHaveLength(0);
    });

    it("detects multiple completions at once", async () => {
      const fspClient = new MockFspClient();
      const detector = new LessonCompletionDetector(fspClient);
      const queryParams = {
        startDate: "2026-03-16",
        endDate: "2027-03-16",
        locationId: 1,
      };

      const baseline = await detector.fetchSnapshot(OPERATOR_A, queryParams);
      const allEvents = [...baseline.events.values()];

      // Remove first two events (completed)
      const remaining = allEvents.slice(2);
      vi.spyOn(fspClient, "getSchedulableEvents").mockResolvedValue(remaining);

      const result = await detector.detect(OPERATOR_A, baseline, queryParams);

      expect(result.completions).toHaveLength(2);
      const completedIds = result.completions.map((c) => c.eventId);
      expect(completedIds).toContain(allEvents[0].eventId);
      expect(completedIds).toContain(allEvents[1].eventId);
    });
  });

  // =========================================================================
  // 6. Tenant Isolation
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("triggers and proposals are scoped by operatorId", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);
      const handler = new NextLessonWorkflowHandler(fspClient);
      registry.register(handler);

      const orchestrator = new Orchestrator(mockDb, fspClient, registry, auditService);
      const triggerService = new TriggerService(mockDb, orchestrator);

      // Operator A trigger
      const triggerA = makeTrigger({ operatorId: OPERATOR_A });
      mockGetTriggerById.mockResolvedValueOnce(triggerA);

      const resultA = await triggerService.createAndDispatch({
        operatorId: OPERATOR_A,
        type: "lesson_complete",
        sourceEntityId: "evt-001",
        sourceEntityType: "schedulable_event",
        context: defaultTriggerContext as unknown as Record<string, unknown>,
      });

      // Operator B trigger
      const triggerB = makeTrigger({
        id: "trigger-nl-002",
        operatorId: OPERATOR_B,
      });
      mockGetTriggerById.mockResolvedValueOnce(triggerB);
      mockCreateTrigger.mockResolvedValueOnce("trigger-nl-002");

      const resultB = await triggerService.createAndDispatch({
        operatorId: OPERATOR_B,
        type: "lesson_complete",
        sourceEntityId: "evt-002",
        sourceEntityType: "schedulable_event",
        context: defaultTriggerContext as unknown as Record<string, unknown>,
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

    it("proposals are scoped to their operator via ProposalBuilder", async () => {
      const builder = new ProposalBuilder(mockDb);

      await builder.buildAndPersist({
        operatorId: OPERATOR_A,
        workflowType: "next_lesson",
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
              trainingContext: {
                enrollmentId: "enr-1",
                lessonId: "les-1",
                lessonName: "Test",
                lessonOrder: 1,
                courseName: "PPL",
              },
            },
          ],
          summary: "Operator A next lesson",
          rawData: null,
        },
      });

      await builder.buildAndPersist({
        operatorId: OPERATOR_B,
        workflowType: "next_lesson",
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
          summary: "Operator B next lesson",
          rawData: null,
        },
      });

      const calls = mockCreateProposal.mock.calls;
      expect(calls[0][1].operatorId).toBe(OPERATOR_A);
      expect(calls[1][1].operatorId).toBe(OPERATOR_B);
    });

    it("executor passes operatorId to all DB calls", async () => {
      const fspClient = new MockFspClient();
      vi.spyOn(fspClient, "getSchedule").mockResolvedValue(emptySchedule());

      const auditService = new AuditService(mockDb);
      const executor = new ReservationExecutor(mockDb, fspClient, auditService, {
        timezoneResolver: () => "UTC",
      });

      mockGetProposalById.mockResolvedValue(makeProposal([makeAction()]));

      await executor.executeProposal(OPERATOR_A, "proposal-nl-001");

      for (const call of mockUpdateActionExecutionStatus.mock.calls) {
        expect(call[1]).toBe(OPERATOR_A);
      }

      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-nl-001",
        "executed",
      );
    });
  });

  // =========================================================================
  // 7. Error Handling
  // =========================================================================

  describe("Error Handling", () => {
    it("handles FSP failure when handler throws", async () => {
      const fspClient = new MockFspClient();
      const registry = new WorkflowRegistry();
      const auditService = new AuditService(mockDb);

      registry.register({
        type: "next_lesson",
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
              Start: "2026-03-17T10:00:00Z",
              End: "2026-03-17T12:00:00Z",
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

      const result = await executor.executeProposal(OPERATOR_A, "proposal-nl-001");

      expect(result.success).toBe(false);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain("already booked");

      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "proposal-nl-001",
        "failed",
      );
    });

    it("FSP validation failure marks proposal as failed with error details", async () => {
      const fspClient = new MockFspClient();
      vi.spyOn(fspClient, "getSchedule").mockResolvedValue(emptySchedule());
      vi.spyOn(fspClient, "validateReservation").mockResolvedValue({
        errors: [
          { message: "Aircraft under maintenance", field: "aircraftId" },
          { message: "Instructor not available", field: "instructorId" },
        ],
      });

      const auditService = new AuditService(mockDb);
      const executor = new ReservationExecutor(mockDb, fspClient, auditService, {
        timezoneResolver: () => "UTC",
      });

      mockGetProposalById.mockResolvedValue(makeProposal([makeAction()]));

      const result = await executor.executeProposal(OPERATOR_A, "proposal-nl-001");

      expect(result.success).toBe(false);
      expect(result.results[0].error).toBe(
        "Aircraft under maintenance; Instructor not available",
      );

      expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
        mockDb,
        OPERATOR_A,
        "action-nl-001",
        expect.objectContaining({
          validationStatus: "invalid",
          executionStatus: "failed",
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

    it("workflow returns empty when trigger has no context", async () => {
      const fspClient = new MockFspClient();
      const handler = new NextLessonWorkflowHandler(fspClient);

      const result = await handler.execute({
        operatorId: OPERATOR_A,
        trigger: makeTrigger({ context: null }),
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
          autoApprovalEnabled: false,
          autoApprovalThreshold: 0.7,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      });

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No lesson completion context");
    });

    it("proposal builder persists proposal with correct priority for next_lesson", async () => {
      const builder = new ProposalBuilder(mockDb);

      await builder.buildAndPersist({
        operatorId: OPERATOR_A,
        workflowType: "next_lesson",
        triggerId: "trigger-nl-001",
        result: {
          proposedActions: [
            {
              rank: 1,
              actionType: "create_reservation",
              startTime: new Date("2026-03-17T10:00:00"),
              endTime: new Date("2026-03-17T12:00:00"),
              locationId: 1,
              studentId: STUDENT_ID,
              instructorId: "inst-aaa-1111",
              aircraftId: "ac-1",
              activityTypeId: "at-1",
            },
          ],
          summary: "1 slot found for next lesson",
          rawData: null,
        },
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          operatorId: OPERATOR_A,
          workflowType: "next_lesson",
          priority: 40, // next_lesson priority
          affectedStudentIds: [STUDENT_ID],
        }),
      );
    });
  });
});
