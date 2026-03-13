import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextLessonResolver } from "../next-lesson-resolver";
import type { IFspClient } from "@/lib/fsp-client";
import type { FspEnrollment, FspSchedulableEvent } from "@/lib/types/fsp";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const OPERATOR_ID = 1;
const STUDENT_ID = "stu-aaa-1111";
const ENROLLMENT_ID = "enr-001";

function makeEnrollment(
  overrides: Partial<FspEnrollment> = {},
): FspEnrollment {
  return {
    enrollmentId: ENROLLMENT_ID,
    studentId: STUDENT_ID,
    courseId: "crs-ppl",
    courseName: "Private Pilot License",
    startDate: "2025-11-01",
    status: "Active",
    ...overrides,
  };
}

function makeEvent(
  overrides: Partial<FspSchedulableEvent> = {},
): FspSchedulableEvent {
  return {
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
    instructorIds: ["inst-aaa-1111"],
    aircraftIds: ["ac-1"],
    schedulingGroupIds: [],
    meetingRoomIds: [],
    isStageCheck: false,
    reservationTypeId: "rt-1",
    activityTypeId: "at-1",
    ...overrides,
  };
}

function makeMockFspClient(
  enrollments: FspEnrollment[] = [makeEnrollment()],
  events: FspSchedulableEvent[] = [makeEvent()],
): IFspClient {
  return {
    getEnrollments: vi.fn().mockResolvedValue(enrollments),
    getSchedulableEvents: vi.fn().mockResolvedValue(events),
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
    findATime: vi.fn(),
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

describe("NextLessonResolver", () => {
  let fspClient: IFspClient;
  let resolver: NextLessonResolver;

  beforeEach(() => {
    fspClient = makeMockFspClient();
    resolver = new NextLessonResolver(fspClient);
  });

  describe("happy path", () => {
    it("resolves the next event from enrollment", async () => {
      const result = await resolver.getNextLesson(
        OPERATOR_ID,
        STUDENT_ID,
        ENROLLMENT_ID,
      );

      expect(result).not.toBeNull();
      expect(result!.nextEvent.eventId).toBe("evt-001");
      expect(result!.enrollmentId).toBe(ENROLLMENT_ID);
      expect(result!.studentId).toBe(STUDENT_ID);
    });

    it("returns the event with lowest lessonOrder when multiple exist", async () => {
      const events = [
        makeEvent({ eventId: "evt-002", lessonOrder: 10 }),
        makeEvent({ eventId: "evt-001", lessonOrder: 8 }),
        makeEvent({ eventId: "evt-003", lessonOrder: 12 }),
      ];

      fspClient = makeMockFspClient([makeEnrollment()], events);
      resolver = new NextLessonResolver(fspClient);

      const result = await resolver.getNextLesson(
        OPERATOR_ID,
        STUDENT_ID,
        ENROLLMENT_ID,
      );

      expect(result).not.toBeNull();
      expect(result!.nextEvent.eventId).toBe("evt-001");
      expect(result!.nextEvent.lessonOrder).toBe(8);
    });
  });

  describe("all events completed", () => {
    it("returns null when no schedulable events remain", async () => {
      fspClient = makeMockFspClient([makeEnrollment()], []);
      resolver = new NextLessonResolver(fspClient);

      const result = await resolver.getNextLesson(
        OPERATOR_ID,
        STUDENT_ID,
        ENROLLMENT_ID,
      );

      expect(result).toBeNull();
    });
  });

  describe("no active enrollment", () => {
    it("returns null when enrollment is not found", async () => {
      fspClient = makeMockFspClient([], [makeEvent()]);
      resolver = new NextLessonResolver(fspClient);

      const result = await resolver.getNextLesson(
        OPERATOR_ID,
        STUDENT_ID,
        ENROLLMENT_ID,
      );

      expect(result).toBeNull();
    });

    it("returns null when enrollment status is not Active", async () => {
      fspClient = makeMockFspClient(
        [makeEnrollment({ status: "Suspended" })],
        [makeEvent()],
      );
      resolver = new NextLessonResolver(fspClient);

      const result = await resolver.getNextLesson(
        OPERATOR_ID,
        STUDENT_ID,
        ENROLLMENT_ID,
      );

      expect(result).toBeNull();
    });
  });

  describe("multiple enrollments", () => {
    it("resolves events for the correct enrollment only", async () => {
      const enrollments = [
        makeEnrollment({ enrollmentId: "enr-001" }),
        makeEnrollment({ enrollmentId: "enr-other" }),
      ];
      const events = [
        makeEvent({ eventId: "evt-001", enrollmentId: "enr-001", lessonOrder: 8 }),
        makeEvent({ eventId: "evt-other", enrollmentId: "enr-other", lessonOrder: 3 }),
      ];

      fspClient = makeMockFspClient(enrollments, events);
      resolver = new NextLessonResolver(fspClient);

      const result = await resolver.getNextLesson(
        OPERATOR_ID,
        STUDENT_ID,
        "enr-001",
      );

      expect(result).not.toBeNull();
      expect(result!.nextEvent.eventId).toBe("evt-001");
      expect(result!.nextEvent.enrollmentId).toBe("enr-001");
    });
  });
});
