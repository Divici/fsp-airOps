import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscoveryFlightWorkflowHandler } from "../workflows/discovery-flight";
import type { DiscoveryFlightContext } from "../workflows/discovery-flight.types";
import type { WorkflowContext } from "@/lib/types/workflow";
import type { OperatorSettings, SchedulingTrigger } from "@/lib/db/schema";
import type { IFspClient } from "@/lib/fsp-client";
import type { SlotOption } from "@/lib/types/workflow";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockProspectContext: DiscoveryFlightContext = {
  prospectId: "prospect-001",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  preferredLocationId: 1,
  preferredDateStart: "2026-03-16",
  preferredDateEnd: "2026-03-23",
};

const mockSettings: OperatorSettings = {
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
};

function makeTrigger(
  context: DiscoveryFlightContext | null = mockProspectContext
): SchedulingTrigger {
  return {
    id: "trigger-1",
    operatorId: 1,
    type: "discovery_request",
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
  overrides: Partial<WorkflowContext> = {}
): WorkflowContext {
  return {
    operatorId: 1,
    trigger: makeTrigger(),
    settings: mockSettings,
    ...overrides,
  };
}

/** Create slots at various hours of the day. */
function makeSlots(count: number): SlotOption[] {
  return Array.from({ length: count }, (_, i) => ({
    startTime: new Date(`2026-03-${16 + i}T${8 + i * 2}:00:00`),
    endTime: new Date(`2026-03-${16 + i}T${9 + i * 2}:00:00`),
    instructorId: `inst-${i + 1}`,
    aircraftId: `ac-${i + 1}`,
    locationId: 1,
    score: 100 - i * 15,
  }));
}

function makeMockFspClient(
  slots: SlotOption[] = makeSlots(5)
): IFspClient {
  return {
    findATime: vi.fn().mockResolvedValue(slots),
    getCivilTwilight: vi.fn().mockResolvedValue({
      startDate: "2026-03-16T06:15:00",
      endDate: "2026-03-16T18:45:00",
    }),
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
  } as unknown as IFspClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DiscoveryFlightWorkflowHandler", () => {
  let fspClient: IFspClient;
  let handler: DiscoveryFlightWorkflowHandler;

  beforeEach(() => {
    fspClient = makeMockFspClient();
    handler = new DiscoveryFlightWorkflowHandler(fspClient);
  });

  it("has type discovery_flight", () => {
    expect(handler.type).toBe("discovery_flight");
  });

  describe("happy path", () => {
    it("returns top N ranked proposal actions from found slots", async () => {
      const context = makeContext();
      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(3); // topNAlternatives = 3
      expect(result.proposedActions[0].rank).toBe(1);
      expect(result.proposedActions[0].actionType).toBe("create_reservation");
      expect(result.proposedActions[0].studentId).toBe("prospect-001");
      expect(result.summary).toContain("3 discovery flight slots");
      expect(result.summary).toContain("Jane Doe");
    });

    it("calls getCivilTwilight with correct location", async () => {
      const context = makeContext();
      await handler.execute(context);

      expect(fspClient.getCivilTwilight).toHaveBeenCalledWith(1, "1");
    });

    it("passes correct search dates to findATime", async () => {
      const context = makeContext();
      await handler.execute(context);

      const [operatorId, params] = (
        fspClient.findATime as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(operatorId).toBe(1);
      expect(params.startDate).toBe("2026-03-16");
      expect(params.endDate).toBe("2026-03-23");
      expect(params.duration).toBe(60); // default discovery flight duration
    });

    it("includes raw data with slot counts", async () => {
      const context = makeContext();
      const result = await handler.execute(context);

      const rawData = result.rawData as {
        prospectContext: DiscoveryFlightContext;
        slotsFound: number;
        slotsRanked: number;
      };

      expect(rawData.prospectContext.prospectId).toBe("prospect-001");
      expect(rawData.slotsFound).toBe(5);
    });
  });

  describe("no available slots", () => {
    it("returns empty actions with appropriate summary", async () => {
      fspClient = makeMockFspClient([]);
      handler = new DiscoveryFlightWorkflowHandler(fspClient);

      const context = makeContext();
      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No available discovery flight slots");
      expect(result.summary).toContain("Jane Doe");
    });
  });

  describe("daylight constraint filtering", () => {
    it("filters out slots outside civil twilight hours", async () => {
      // Twilight: 06:15 - 18:45
      // Create slots: one at 5am (before dawn), one at 10am (daylight), one at 20pm (after dusk)
      const slots: SlotOption[] = [
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
      ];

      fspClient = makeMockFspClient(slots);
      handler = new DiscoveryFlightWorkflowHandler(fspClient);

      const context = makeContext();
      const result = await handler.execute(context);

      // Only the 10am slot should pass the daylight filter
      expect(result.proposedActions).toHaveLength(1);
      expect(result.proposedActions[0].instructorId).toBe("inst-2");
    });

    it("filters out slots that end after twilight", async () => {
      // Twilight ends at 18:45 — a slot that starts at 18:00 and ends at 19:00 should be excluded
      const slots: SlotOption[] = [
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
      ];

      fspClient = makeMockFspClient(slots);
      handler = new DiscoveryFlightWorkflowHandler(fspClient);

      const context = makeContext();
      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(1);
      expect(result.proposedActions[0].instructorId).toBe("inst-2");
    });
  });

  describe("preference matching", () => {
    it("filters by preferred time windows when provided", async () => {
      // Morning preference: 8-12
      const contextWithPrefs = makeContext({
        trigger: makeTrigger({
          ...mockProspectContext,
          preferredTimeWindows: [{ start: "8", end: "12" }],
        }),
      });

      // Slots at 8am, 10am, 14pm, 16pm, 18pm
      const slots: SlotOption[] = [
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
      ];

      fspClient = makeMockFspClient(slots);
      handler = new DiscoveryFlightWorkflowHandler(fspClient);

      const result = await handler.execute(contextWithPrefs);

      // Only the 8am and 10am slots match morning preference
      expect(result.proposedActions).toHaveLength(2);
    });
  });

  describe("missing context", () => {
    it("returns empty result when trigger has no context", async () => {
      const context = makeContext({
        trigger: makeTrigger(null),
      });

      const result = await handler.execute(context);

      expect(result.proposedActions).toHaveLength(0);
      expect(result.summary).toContain("No prospect request context");
    });
  });

  describe("search window defaults", () => {
    it("uses current date + searchWindowDays when no preferred dates given", async () => {
      const contextNoPrefs = makeContext({
        trigger: makeTrigger({
          ...mockProspectContext,
          preferredDateStart: undefined,
          preferredDateEnd: undefined,
        }),
      });

      await handler.execute(contextNoPrefs);

      const [, params] = (
        fspClient.findATime as ReturnType<typeof vi.fn>
      ).mock.calls[0];

      // Start date should be today (can't predict exact value)
      expect(params.startDate).toBeDefined();
      expect(params.endDate).toBeDefined();
    });
  });
});
