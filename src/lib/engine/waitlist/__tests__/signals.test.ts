import { describe, it, expect } from "vitest";
import {
  computeTimeSinceLastFlight,
  computeTimeUntilNextFlight,
  computeTotalHours,
  computeInstructorContinuity,
  computeAircraftFamiliarity,
  normalizeSignal,
} from "../signals";
import type { FspScheduleResponse } from "@/lib/types/fsp";

const mockSchedule: FspScheduleResponse = {
  results: {
    events: [
      {
        Start: "2026-03-16T08:00:00",
        End: "2026-03-16T10:00:00",
        Title: "Dual Flight",
        CustomerName: "Alex Rivera",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345",
      },
      {
        Start: "2026-03-18T08:00:00",
        End: "2026-03-18T10:00:00",
        Title: "Dual Flight",
        CustomerName: "Alex Rivera",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345",
      },
      {
        Start: "2026-03-20T14:00:00",
        End: "2026-03-20T16:00:00",
        Title: "Dual Flight",
        CustomerName: "Alex Rivera",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345",
      },
    ],
    resources: [],
    unavailability: [],
  },
};

describe("computeTimeSinceLastFlight", () => {
  it("should compute hours since the last flight", () => {
    const now = new Date("2026-03-19T10:00:00");
    const hours = computeTimeSinceLastFlight(mockSchedule, "Alex Rivera", now);
    // Last completed flight ended 2026-03-18T10:00:00, now is 2026-03-19T10:00:00 => 24h
    expect(hours).toBe(24);
  });

  it("should return Infinity when no past flights exist", () => {
    const now = new Date("2026-03-15T08:00:00"); // Before any events
    const hours = computeTimeSinceLastFlight(
      mockSchedule,
      "Alex Rivera",
      now,
    );
    expect(hours).toBe(Infinity);
  });

  it("should return Infinity for unknown student", () => {
    const hours = computeTimeSinceLastFlight(
      mockSchedule,
      "Unknown Student",
      new Date("2026-03-19T10:00:00"),
    );
    expect(hours).toBe(Infinity);
  });
});

describe("computeTimeUntilNextFlight", () => {
  it("should compute hours until next flight", () => {
    const now = new Date("2026-03-17T10:00:00");
    const hours = computeTimeUntilNextFlight(mockSchedule, "Alex Rivera", now);
    // Next flight starts 2026-03-18T08:00:00, now is 2026-03-17T10:00:00 => 22h
    expect(hours).toBe(22);
  });

  it("should return Infinity when no future flights exist", () => {
    const now = new Date("2026-03-21T10:00:00"); // After all events
    const hours = computeTimeUntilNextFlight(
      mockSchedule,
      "Alex Rivera",
      now,
    );
    expect(hours).toBe(Infinity);
  });
});

describe("computeTotalHours", () => {
  it("should return the completed flight hours value", () => {
    expect(computeTotalHours(14.5)).toBe(14.5);
    expect(computeTotalHours(0)).toBe(0);
  });
});

describe("computeInstructorContinuity", () => {
  it("should return 1 when instructors match", () => {
    expect(computeInstructorContinuity("inst-1", "inst-1")).toBe(1);
  });

  it("should return 0 when instructors differ", () => {
    expect(computeInstructorContinuity("inst-1", "inst-2")).toBe(0);
  });

  it("should return 0 when either instructor is undefined", () => {
    expect(computeInstructorContinuity(undefined, "inst-1")).toBe(0);
    expect(computeInstructorContinuity("inst-1", undefined)).toBe(0);
  });
});

describe("computeAircraftFamiliarity", () => {
  it("should return 1 when student has flown the aircraft", () => {
    expect(computeAircraftFamiliarity(["ac-1", "ac-2"], "ac-1")).toBe(1);
  });

  it("should return 0 when student has not flown the aircraft", () => {
    expect(computeAircraftFamiliarity(["ac-1", "ac-2"], "ac-3")).toBe(0);
  });

  it("should return 0 when aircraft is undefined", () => {
    expect(computeAircraftFamiliarity(["ac-1"], undefined)).toBe(0);
  });
});

describe("normalizeSignal", () => {
  it("should normalize within range", () => {
    expect(normalizeSignal(50, 0, 100)).toBe(0.5);
    expect(normalizeSignal(0, 0, 100)).toBe(0);
    expect(normalizeSignal(100, 0, 100)).toBe(1);
  });

  it("should clamp values outside range", () => {
    expect(normalizeSignal(-10, 0, 100)).toBe(0);
    expect(normalizeSignal(150, 0, 100)).toBe(1);
  });

  it("should return 0.5 when min equals max", () => {
    expect(normalizeSignal(5, 5, 5)).toBe(0.5);
  });

  it("should return 1 for Infinity values", () => {
    expect(normalizeSignal(Infinity, 0, 100)).toBe(1);
  });
});
