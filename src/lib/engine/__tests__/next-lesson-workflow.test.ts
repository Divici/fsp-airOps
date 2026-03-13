import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextLessonWorkflowHandler } from "../workflows/next-lesson";
import type { NextLessonWorkflowContext } from "../workflows/next-lesson.types";
import type { WorkflowContext } from "@/lib/types/workflow";
import type { OperatorSettings, SchedulingTrigger } from "@/lib/db/schema";
import type { IFspClient } from "@/lib/fsp-client";
import type { SlotOption } from "@/lib/types/workflow";
import type { FspEnrollment, FspSchedulableEvent } from "@/lib/types/fsp";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const STUDENT_ID = "stu-aaa-1111";
const ENROLLMENT_ID = "enr-001";

const mockTriggerContext: NextLessonWorkflowContext = {
  studentId: STUDENT_ID,
  enrollmentId: ENROLLMENT_ID,
  completedEventId: "evt-007",
  completedInstructorId: "inst-aaa-1111",
};

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
  topNAlternatives: 3,
  daylightOnly: true,
  enabledWorkflows: {
    reschedule: true,
    discovery_flight: true,
    next_lesson: true,
    waitlist: true,
  },
  communicationPreferences: { email: true, sms: false },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const mockEnrollment: FspEnrollment = {
  enrollmentId: ENROLLMENT_ID,
  studentId: STUDENT_ID,
  courseId: "crs-ppl",
  courseName: "Private Pilot License",
  startDate: "2025-11-01",
  status: "Active",
};

const mockNextEvent: FspSchedulableEvent = {
  eventId: "evt-001",
  enrollmentId: ENROLLMENT_ID,
  studentId: STUDENT_ID,
  studentFirstName: "Alex",
  studentLastName: "Rivera",
  courseId: "crs-ppl",
  courseName: "Private Pilot License",
  lessonId: "les-ppl-08",
  lessonName: "PPL Lesson 8 - Slow Flight & Stalls",
  lessonOrder: 8,
  flightType: 0,
  routeType: 0,
  timeOfDay: 1,
  durationTotal: 120,
  aircraftDurationTotal: 90,
  instructorDurationPre: 15,
  instructorDurationPost: 15,
  instructorDurationTotal: 120,
  instructorRequired: true,
  instructorIds: ["inst-aaa-1111", "inst-ddd-4444"],
  aircraftIds: ["ac-1", "ac-4"],
  schedulingGroupIds: [],
  meetingRoomIds: [],
  isStageCheck: false,
  reservationTypeId: "rt-1",
  activityTypeId: "at-1",
};

function makeTrigger(
  context: NextLessonWorkflowContext | null = mockTriggerContext,
): SchedulingTrigger {
  return {
    id: "trigger-1",
    operatorId: 1,
    type: "lesson_complete",
    status: "pending",
    sourceEntityId: null,
    sourceEntityType: null,
    context: context as unknown as SchedulingTrigger["context"],
    processedAt: null,
    error: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

function makeContext(
  overrides: Partial<WorkflowContext> = {},
): WorkflowContext {
  return {
    operatorId: 1,
    trigger: makeTrigger(),
    settings: mockSettings,
    ...overrides,
  };
}

function makeSlots(count: number): SlotOption[] {
  return Array.from({ length: count }, (_, i) => ({
    startTime: new Date(`2026-03-${16 + i}T${8 + i * 2}:00:00`),
    endTime: new Date(`2026-03-${16 + i}T${10 + i * 2}:00:00`),
    instructorId: i === 0 ? "inst-aaa-1111" : `inst-${i + 1}`,
    aircraftId: i === 0 ? "ac-1" : `ac-${i + 1}`,
    locationId: 1,
    score: 100 - i * 15,
  }));
}

function makeMockFspClient(
  enrollments: FspEnrollment[] = [mockEnrollment],
  events: FspSchedulableEvent[] = [mockNextEvent],
  slots: SlotOption[] = makeSlots(5),
): IFspClient {
  return {
    getEnrollments: vi.fn().mockResolvedValue(enrollments),
    getSchedulableEvents: vi.fn().mockResolvedValue(events),
    findATime: vi.fn().mockResolvedValue(slots),
    // Stubs for unused methods
    authenticate: vi.fn(),
    refreshSession: vi.fn(),
    getLocations: vi.fn(),
    getAircraft: vi.fn(),
    getInstructors: vi.fn(),
    getActivityTypes: vi.fn(),
    getSchedulingGroups: vi.fn(),
    getUsers: vi.fn(),
    getAvailability: vi.fn(),
    getSchedule: vi.fn(),
    autoSchedule: vi.fn(),
    validateReservation: vi.fn(),
    createReservation: vi.fn(),
    getReservation: vi.fn(),
    listReservations: vi.fn(),
    getEnrollmentProgress: vi.fn(),
    getCivilTwilight: vi.fn(),
  } as unknown as IFspClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NextLessonWorkflowHandler", () => {
  let fspClient: IFspClient;
  let handler: NextLessonWorkflowHandler;

  beforeEach(() => {
    fspClient = makeMockFspClient();
    handler = new NextLessonWorkflowHandler(fspClient);
  });

  it("has type next_lesson", () => {
    expect(handler.type).toBe("next_lesson");
  });

  describe("happy path", () => {
    it("returns top N ranked proposal actions for the next lesson", async () => {
      const context = makeContext();
      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(3); // topNAlternatives = 3
      expect(result.proposedActions[0].rank).toBe(1);
      expect(result.proposedActions[0].actionType).toBe("create_reservation");
      expect(result.proposedActions[0].studentId).toBe(STUDENT_ID);
      expect(result.proposedActions[0].activityTypeId).toBe("at-1");
      expect(result.summary).toContain("3 slots");
      expect(result.summary).toContain("PPL Lesson 8");
    });

    it("includes training context in proposal actions", async () => {
      const context = makeContext();
      const result = await handler.execute(context);

      const action = result.proposedActions[0];
      expect(action.trainingContext).toBeDefined();
      expect(action.trainingContext!.enrollmentId).toBe(ENROLLMENT_ID);
      expect(action.trainingContext!.lessonId).toBe("les-ppl-08");
      expect(action.trainingContext!.lessonName).toBe(
        "PPL Lesson 8 - Slow Flight & Stalls",
      );
    });

    it("passes correct params to Find-a-Time", async () => {
      const context = makeContext();
      await handler.execute(context);

      expect(fspClient.findATime).toHaveBeenCalledTimes(1);
      const [operatorId, params] = (
        fspClient.findATime as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(operatorId).toBe(1);
      expect(params.activityTypeId).toBe("at-1");
      expect(params.customerId).toBe(STUDENT_ID);
      expect(params.duration).toBe(120);
      // Instructor continuity: completed instructor should be first
      expect(params.instructorIds[0]).toBe("inst-aaa-1111");
    });
  });

  describe("no next lesson available", () => {
    it("returns empty result when all events completed", async () => {
      fspClient = makeMockFspClient([mockEnrollment], []);
      handler = new NextLessonWorkflowHandler(fspClient);

      const context = makeContext();
      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No next lesson available");
    });
  });

  describe("instructor continuity preference", () => {
    it("prefers the same instructor when ranking slots", async () => {
      const slots: SlotOption[] = [
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
      ];

      fspClient = makeMockFspClient([mockEnrollment], [mockNextEvent], slots);
      handler = new NextLessonWorkflowHandler(fspClient);

      const context = makeContext({
        settings: {
          ...mockSettings,
          preferSameInstructor: true,
          preferSameInstructorWeight: 0.8,
        },
      });

      const result = await handler.execute(context);

      // Same instructor slot should rank higher despite lower base score
      expect(result.proposedActions[0].instructorId).toBe("inst-aaa-1111");
    });
  });

  describe("no available slots", () => {
    it("returns empty actions with appropriate summary", async () => {
      fspClient = makeMockFspClient([mockEnrollment], [mockNextEvent], []);
      handler = new NextLessonWorkflowHandler(fspClient);

      const context = makeContext();
      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No available slots");
      expect(result.summary).toContain("PPL Lesson 8");
    });
  });

  describe("missing context", () => {
    it("returns empty result when trigger has no context", async () => {
      const context = makeContext({
        trigger: makeTrigger(null),
      });

      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No lesson completion context");
    });
  });

  describe("ranking respects training context", () => {
    it("returns only topNAlternatives slots", async () => {
      fspClient = makeMockFspClient(
        [mockEnrollment],
        [mockNextEvent],
        makeSlots(10),
      );
      handler = new NextLessonWorkflowHandler(fspClient);

      const context = makeContext({
        settings: { ...mockSettings, topNAlternatives: 2 },
      });

      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(2);
      expect(result.proposedActions[0].rank).toBe(1);
      expect(result.proposedActions[1].rank).toBe(2);
    });
  });
});
