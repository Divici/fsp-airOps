import { describe, it, expect, vi, beforeEach } from "vitest";
import { RescheduleWorkflowHandler } from "../workflows/reschedule";
import type { CancelledReservationContext } from "../workflows/reschedule.types";
import type { WorkflowContext } from "@/lib/types/workflow";
import type { OperatorSettings, SchedulingTrigger } from "@/lib/db/schema";
import type { IFspClient } from "@/lib/fsp-client";
import type { SlotOption } from "@/lib/types/workflow";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockCancelledReservation: CancelledReservationContext = {
  reservationId: "res-001",
  studentId: "student-1",
  studentName: "Jane Doe",
  instructorId: "inst-1",
  aircraftId: "ac-1",
  activityTypeId: "at-1",
  locationId: 1,
  originalStart: "2026-03-15T10:00:00",
  originalEnd: "2026-03-15T12:00:00",
  cancellationReason: "Weather",
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

function makeTrigger(
  context: CancelledReservationContext | null = mockCancelledReservation,
): SchedulingTrigger {
  return {
    id: "trigger-1",
    operatorId: 1,
    type: "cancellation",
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
    instructorId: i === 0 ? "inst-1" : `inst-${i + 1}`,
    aircraftId: i === 0 ? "ac-1" : `ac-${i + 1}`,
    locationId: 1,
    score: 100 - i * 15,
  }));
}

function makeMockFspClient(slots: SlotOption[] = makeSlots(5)): IFspClient {
  return {
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
    getSchedulableEvents: vi.fn(),
    autoSchedule: vi.fn(),
    validateReservation: vi.fn(),
    createReservation: vi.fn(),
    getReservation: vi.fn(),
    listReservations: vi.fn(),
    getEnrollments: vi.fn(),
    getEnrollmentProgress: vi.fn(),
    getCivilTwilight: vi.fn(),
  } as unknown as IFspClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RescheduleWorkflowHandler", () => {
  let fspClient: IFspClient;
  let handler: RescheduleWorkflowHandler;

  beforeEach(() => {
    fspClient = makeMockFspClient();
    handler = new RescheduleWorkflowHandler(fspClient);
  });

  it("has type reschedule", () => {
    expect(handler.type).toBe("reschedule");
  });

  describe("happy path", () => {
    it("returns top N ranked proposal actions from found slots", async () => {
      const context = makeContext();
      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(3); // topNAlternatives = 3
      expect(result.proposedActions[0].rank).toBe(1);
      expect(result.proposedActions[0].actionType).toBe("create_reservation");
      expect(result.proposedActions[0].studentId).toBe("student-1");
      expect(result.proposedActions[0].activityTypeId).toBe("at-1");
      expect(result.summary).toContain("3 alternative slots");
      expect(result.summary).toContain("Jane Doe");
    });

    it("passes correct params to Find-a-Time", async () => {
      const context = makeContext();
      await handler.execute(context);

      expect(fspClient.findATime).toHaveBeenCalledTimes(1);
      const [operatorId, params] = (fspClient.findATime as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(operatorId).toBe(1);
      expect(params.activityTypeId).toBe("at-1");
      expect(params.instructorIds).toEqual(["inst-1"]);
      expect(params.customerId).toBe("student-1");
      expect(params.duration).toBe(120); // 2 hours
    });

    it("includes raw data in result", async () => {
      const context = makeContext();
      const result = await handler.execute(context);

      const rawData = result.rawData as {
        cancelledReservation: CancelledReservationContext;
        slotsFound: number;
        slotsRanked: number;
      };

      expect(rawData.cancelledReservation.reservationId).toBe("res-001");
      expect(rawData.slotsFound).toBe(5);
      expect(rawData.slotsRanked).toBe(5);
    });
  });

  describe("no available slots", () => {
    it("returns empty actions with appropriate summary", async () => {
      fspClient = makeMockFspClient([]);
      handler = new RescheduleWorkflowHandler(fspClient);

      const context = makeContext();
      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No alternative slots found");
      expect(result.summary).toContain("Jane Doe");
    });
  });

  describe("slot ranking", () => {
    it("prefers same instructor when setting is enabled", async () => {
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
          instructorId: "inst-1", // same as cancelled reservation
          aircraftId: "ac-1",
          locationId: 1,
          score: 50, // lower base score
        },
      ];

      fspClient = makeMockFspClient(slots);
      handler = new RescheduleWorkflowHandler(fspClient);

      const context = makeContext({
        settings: {
          ...mockSettings,
          preferSameInstructor: true,
          preferSameInstructorWeight: 0.8,
        },
      });

      const result = await handler.execute(context);

      // Same instructor slot should rank higher despite lower base score
      expect(result.proposedActions[0].instructorId).toBe("inst-1");
    });
  });

  describe("search window", () => {
    it("uses operator settings searchWindowDays for date range", async () => {
      const context = makeContext({
        settings: { ...mockSettings, searchWindowDays: 14 },
      });

      await handler.execute(context);

      const [, params] = (fspClient.findATime as ReturnType<typeof vi.fn>).mock.calls[0];
      const start = new Date(params.startDate);
      const end = new Date(params.endDate);
      const daysDiff = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      expect(daysDiff).toBe(14);
    });
  });

  describe("top N limit", () => {
    it("returns only topNAlternatives slots", async () => {
      fspClient = makeMockFspClient(makeSlots(10));
      handler = new RescheduleWorkflowHandler(fspClient);

      const context = makeContext({
        settings: { ...mockSettings, topNAlternatives: 2 },
      });

      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(2);
      expect(result.proposedActions[0].rank).toBe(1);
      expect(result.proposedActions[1].rank).toBe(2);
    });
  });

  describe("missing context", () => {
    it("returns empty result when trigger has no context", async () => {
      const context = makeContext({
        trigger: makeTrigger(null),
      });

      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No cancelled reservation context");
    });
  });
});
