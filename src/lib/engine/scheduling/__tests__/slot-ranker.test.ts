import { describe, it, expect } from "vitest";
import { rankSlots, type SlotRankingCriteria } from "../slot-ranker";
import type { SlotOption } from "@/lib/types/workflow";

function makeSlot(overrides: Partial<SlotOption> = {}): SlotOption {
  return {
    startTime: new Date("2026-03-16T10:00:00"),
    endTime: new Date("2026-03-16T12:00:00"),
    instructorId: "inst-1",
    aircraftId: "ac-1",
    locationId: 1,
    score: 50,
    ...overrides,
  };
}

const noCriteria: SlotRankingCriteria = {
  preferSameInstructor: false,
  preferSameInstructorWeight: 0.8,
  preferSameAircraft: false,
  preferSameAircraftWeight: 0.3,
};

describe("rankSlots", () => {
  it("same instructor gets bonus score", () => {
    const slots = [
      makeSlot({ instructorId: "inst-1", score: 50 }),
      makeSlot({ instructorId: "inst-2", score: 50 }),
    ];

    const criteria: SlotRankingCriteria = {
      preferSameInstructor: true,
      preferSameInstructorWeight: 0.8,
      preferredInstructorId: "inst-1",
      preferSameAircraft: false,
      preferSameAircraftWeight: 0.3,
    };

    const ranked = rankSlots(slots, criteria);

    expect(ranked[0].instructorId).toBe("inst-1");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("same aircraft gets bonus score", () => {
    const slots = [
      makeSlot({ aircraftId: "ac-other", score: 50 }),
      makeSlot({ aircraftId: "ac-1", score: 50 }),
    ];

    const criteria: SlotRankingCriteria = {
      preferSameInstructor: false,
      preferSameInstructorWeight: 0.8,
      preferSameAircraft: true,
      preferSameAircraftWeight: 0.3,
      preferredAircraftId: "ac-1",
    };

    const ranked = rankSlots(slots, criteria);

    expect(ranked[0].aircraftId).toBe("ac-1");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("sorts slots by score descending", () => {
    const slots = [
      makeSlot({ score: 30 }),
      makeSlot({ score: 90 }),
      makeSlot({ score: 60 }),
    ];

    const ranked = rankSlots(slots, noCriteria);

    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
  });

  it("works with no preferences (equal base scoring)", () => {
    const slots = [
      makeSlot({ instructorId: "inst-1", aircraftId: "ac-1", score: 50 }),
      makeSlot({ instructorId: "inst-2", aircraftId: "ac-2", score: 50 }),
    ];

    const ranked = rankSlots(slots, noCriteria);

    // Both should have the same score when no preferences are active
    expect(ranked[0].score).toBe(ranked[1].score);
  });

  it("applies time-of-day proximity bonus", () => {
    const slots = [
      makeSlot({
        startTime: new Date("2026-03-16T10:00:00"),
        score: 50,
      }),
      makeSlot({
        startTime: new Date("2026-03-16T20:00:00"),
        score: 50,
      }),
    ];

    const criteria: SlotRankingCriteria = {
      ...noCriteria,
      originalStartHour: 10,
    };

    const ranked = rankSlots(slots, criteria);

    // The slot at 10:00 should score higher (closer to original 10:00)
    expect(ranked[0].startTime.getHours()).toBe(10);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("returns empty array for empty input", () => {
    const ranked = rankSlots([], noCriteria);
    expect(ranked).toEqual([]);
  });

  it("combines instructor and aircraft bonuses", () => {
    const slots = [
      makeSlot({ instructorId: "inst-1", aircraftId: "ac-1", score: 50 }),
      makeSlot({ instructorId: "inst-1", aircraftId: "ac-2", score: 50 }),
      makeSlot({ instructorId: "inst-2", aircraftId: "ac-2", score: 50 }),
    ];

    const criteria: SlotRankingCriteria = {
      preferSameInstructor: true,
      preferSameInstructorWeight: 0.8,
      preferredInstructorId: "inst-1",
      preferSameAircraft: true,
      preferSameAircraftWeight: 0.3,
      preferredAircraftId: "ac-1",
    };

    const ranked = rankSlots(slots, criteria);

    // First slot should have both bonuses
    expect(ranked[0].instructorId).toBe("inst-1");
    expect(ranked[0].aircraftId).toBe("ac-1");
  });
});
