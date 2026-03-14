import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkSlotAvailability,
  getStudentHistory,
  getStudentProgress,
  getInstructorSchedule,
  getWeather,
  getOriginalContext,
  SCHEDULING_TOOLS,
} from "../tools/scheduling-tools";
import type { IFspClient } from "@/lib/fsp-client";
import type { AutoApprovalContext } from "../types";

function makeMockFspClient(): IFspClient {
  return {
    authenticate: vi.fn(),
    refreshSession: vi.fn(),
    getLocations: vi.fn(),
    getAircraft: vi.fn(),
    getInstructors: vi.fn(),
    getActivityTypes: vi.fn(),
    getSchedulingGroups: vi.fn(),
    getUsers: vi.fn(),
    getAvailability: vi.fn(),
    getSchedule: vi.fn().mockResolvedValue({
      results: { events: [], resources: [], unavailability: [] },
    }),
    getSchedulableEvents: vi.fn(),
    findATime: vi.fn(),
    autoSchedule: vi.fn(),
    validateReservation: vi.fn(),
    createReservation: vi.fn(),
    getReservation: vi.fn(),
    listReservations: vi.fn().mockResolvedValue([]),
    getEnrollments: vi.fn().mockResolvedValue([]),
    getEnrollmentProgress: vi.fn(),
    getCivilTwilight: vi.fn(),
  } as unknown as IFspClient;
}

describe("SCHEDULING_TOOLS definitions", () => {
  it("exports 6 tool definitions", () => {
    expect(SCHEDULING_TOOLS).toHaveLength(6);
  });

  it("all tools have type 'function' and valid structure", () => {
    for (const tool of SCHEDULING_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.function?.name).toBeTruthy();
      expect(tool.function?.description).toBeTruthy();
      expect(tool.function?.parameters).toBeDefined();
    }
  });

  it("includes all expected tool names", () => {
    const names = SCHEDULING_TOOLS.map((t) => t.function?.name);
    expect(names).toContain("checkSlotAvailability");
    expect(names).toContain("getStudentHistory");
    expect(names).toContain("getStudentProgress");
    expect(names).toContain("getInstructorSchedule");
    expect(names).toContain("getWeather");
    expect(names).toContain("getOriginalContext");
  });
});

describe("checkSlotAvailability", () => {
  let client: IFspClient;

  beforeEach(() => {
    client = makeMockFspClient();
  });

  it("returns available when no conflicts", async () => {
    const result = await checkSlotAvailability(client, 42, {
      startTime: "2026-03-14T10:00:00Z",
      endTime: "2026-03-14T11:00:00Z",
      locationId: 1,
    });

    expect(result).toEqual({ available: true });
  });

  it("returns unavailable when instructor conflict exists", async () => {
    vi.mocked(client.getSchedule).mockResolvedValue({
      results: {
        events: [
          {
            Start: "2026-03-14T09:30:00Z",
            End: "2026-03-14T10:30:00Z",
            Title: "Lesson",
            CustomerName: "Other Student",
            InstructorName: "instructor-1",
            AircraftName: "C172-other",
          },
        ],
        resources: [],
        unavailability: [],
      },
    });

    const result = await checkSlotAvailability(client, 42, {
      startTime: "2026-03-14T10:00:00Z",
      endTime: "2026-03-14T11:00:00Z",
      instructorId: "instructor-1",
      locationId: 1,
    });

    expect(result.available).toBe(false);
    expect(result.reason).toContain("instructor-1");
  });
});

describe("getStudentHistory", () => {
  let client: IFspClient;

  beforeEach(() => {
    client = makeMockFspClient();
  });

  it("returns empty history when no reservations", async () => {
    const result = await getStudentHistory(client, 42, {
      studentId: "student-1",
    });

    expect(result).toEqual({
      recentFlightCount: 0,
      lastFlightDate: null,
      totalReservations: 0,
    });
  });

  it("filters and counts student reservations", async () => {
    vi.mocked(client.listReservations).mockResolvedValue([
      {
        reservationId: "r1",
        reservationNumber: 1,
        resource: "C172",
        start: "2026-03-10T10:00:00Z",
        end: "2026-03-10T11:00:00Z",
        pilotFirstName: "John",
        pilotLastName: "Smith",
        pilotId: "student-1",
        status: 0,
      },
      {
        reservationId: "r2",
        reservationNumber: 2,
        resource: "C172",
        start: "2026-03-12T14:00:00Z",
        end: "2026-03-12T15:00:00Z",
        pilotFirstName: "John",
        pilotLastName: "Smith",
        pilotId: "student-1",
        status: 0,
      },
      {
        reservationId: "r3",
        reservationNumber: 3,
        resource: "C172",
        start: "2026-03-11T09:00:00Z",
        end: "2026-03-11T10:00:00Z",
        pilotFirstName: "Jane",
        pilotLastName: "Doe",
        pilotId: "student-2",
        status: 0,
      },
    ]);

    const result = await getStudentHistory(client, 42, {
      studentId: "student-1",
    });

    expect(result.recentFlightCount).toBe(2);
    expect(result.totalReservations).toBe(2);
    expect(result.lastFlightDate).toBe("2026-03-12T14:00:00Z");
  });
});

describe("getStudentProgress", () => {
  let client: IFspClient;

  beforeEach(() => {
    client = makeMockFspClient();
  });

  it("returns null when student has no enrollments", async () => {
    const result = await getStudentProgress(client, 42, {
      studentId: "student-1",
    });

    expect(result).toBeNull();
  });

  it("returns progress with checkride flag when near completion", async () => {
    vi.mocked(client.getEnrollments).mockResolvedValue([
      {
        enrollmentId: "enr-1",
        studentId: "student-1",
        courseId: "course-ppl",
        courseName: "Private Pilot License",
        startDate: "2025-06-01",
        status: "active",
      },
    ]);
    vi.mocked(client.getEnrollmentProgress).mockResolvedValue({
      enrollmentId: "enr-1",
      completedLessons: 18,
      totalLessons: 20,
      completedFlightHours: 38,
      requiredFlightHours: 40,
    });

    const result = await getStudentProgress(client, 42, {
      studentId: "student-1",
    });

    expect(result).not.toBeNull();
    expect(result!.courseName).toBe("Private Pilot License");
    expect(result!.completedLessons).toBe(18);
    expect(result!.totalLessons).toBe(20);
    expect(result!.percentComplete).toBe(90);
    expect(result!.isNearCheckride).toBe(true);
  });

  it("returns not near checkride when early in training", async () => {
    vi.mocked(client.getEnrollments).mockResolvedValue([
      {
        enrollmentId: "enr-1",
        studentId: "student-1",
        courseId: "course-ppl",
        courseName: "Private Pilot License",
        startDate: "2026-01-01",
        status: "active",
      },
    ]);
    vi.mocked(client.getEnrollmentProgress).mockResolvedValue({
      enrollmentId: "enr-1",
      completedLessons: 5,
      totalLessons: 20,
      completedFlightHours: 10,
      requiredFlightHours: 40,
    });

    const result = await getStudentProgress(client, 42, {
      studentId: "student-1",
    });

    expect(result!.percentComplete).toBe(25);
    expect(result!.isNearCheckride).toBe(false);
  });
});

describe("getInstructorSchedule", () => {
  let client: IFspClient;

  beforeEach(() => {
    client = makeMockFspClient();
  });

  it("returns zero flights when schedule is empty", async () => {
    const result = await getInstructorSchedule(client, 42, {
      instructorId: "instructor-1",
      date: "2026-03-14",
      locationId: 1,
    });

    expect(result).toEqual({ flightsToday: 0, isHeavyDay: false });
  });

  it("counts instructor events and marks heavy days", async () => {
    const events = Array.from({ length: 6 }, (_, i) => ({
      Start: `2026-03-14T${(8 + i).toString().padStart(2, "0")}:00:00Z`,
      End: `2026-03-14T${(9 + i).toString().padStart(2, "0")}:00:00Z`,
      Title: `Lesson ${i + 1}`,
      CustomerName: `Student ${i + 1}`,
      InstructorName: "instructor-1",
      AircraftName: "C172",
    }));

    vi.mocked(client.getSchedule).mockResolvedValue({
      results: { events, resources: [], unavailability: [] },
    });

    const result = await getInstructorSchedule(client, 42, {
      instructorId: "instructor-1",
      date: "2026-03-14",
      locationId: 1,
    });

    expect(result.flightsToday).toBe(6);
    expect(result.isHeavyDay).toBe(true);
  });
});

describe("getWeather", () => {
  it("returns mock VFR data", () => {
    const result = getWeather({ locationId: 1 });

    expect(result.conditions).toBe("VFR");
    expect(result.visibility).toBe("10sm");
    expect(result.ceiling).toBe("clear");
    expect(result.windSpeed).toBe(8);
    expect(result.safeForFlight).toBe(true);
  });
});

describe("getOriginalContext", () => {
  it("returns trigger type and context from the approval context", () => {
    const context: AutoApprovalContext = {
      proposal: {
        id: "prop-1",
        operatorId: 42,
        workflowType: "reschedule",
        summary: "test",
        rationale: "test",
        priority: 5,
        actions: [],
      },
      trigger: {
        id: "trigger-1",
        type: "cancellation",
        context: { cancelledReservationId: "res-123" },
      },
      operatorSettings: {
        preferSameInstructor: true,
        preferSameAircraft: true,
        autoApprovalThreshold: 0.8,
      },
      operatorId: 42,
    };

    const result = getOriginalContext(context);

    expect(result.triggerType).toBe("cancellation");
    expect(result.context).toEqual({ cancelledReservationId: "res-123" });
  });
});
