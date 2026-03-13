import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FspReservationListItem } from "@/lib/types/fsp";
import { createSnapshot, compareSnapshots } from "@/lib/engine/detection/schedule-snapshot";

// Mock db module to avoid DATABASE_URL requirement
vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/db/queries/operators", () => ({
  getActiveOperatorIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/fsp-client", () => ({
  createFspClient: vi.fn(),
}));

vi.mock("@/lib/engine", () => ({
  createOrchestrator: vi.fn(),
}));

import {
  _setSnapshot,
  _getSnapshot,
} from "../evaluate-schedule";

// ---------------------------------------------------------------------------
// We test the evaluate-schedule module's snapshot management and the
// underlying detection logic. The Inngest functions themselves are
// integration-tested via the Inngest dev server; here we verify the
// business logic that the functions orchestrate.
// ---------------------------------------------------------------------------

function makeReservation(
  overrides: Partial<FspReservationListItem> = {},
): FspReservationListItem {
  return {
    reservationId: "res-001",
    reservationNumber: 10001,
    resource: "N12345 - Cessna 172S",
    start: "2026-03-16T08:00:00",
    end: "2026-03-16T10:00:00",
    pilotFirstName: "Alex",
    pilotLastName: "Rivera",
    pilotId: "stu-aaa-1111",
    status: 1,
    ...overrides,
  };
}

const OPERATOR_ID = 42;

describe("evaluate-schedule snapshot store", () => {
  beforeEach(() => {
    _setSnapshot(OPERATOR_ID, null);
  });

  it("stores and retrieves snapshots per operator", () => {
    const snapshot = createSnapshot(OPERATOR_ID, [makeReservation()]);
    _setSnapshot(OPERATOR_ID, snapshot);

    const retrieved = _getSnapshot(OPERATOR_ID);
    expect(retrieved).toBeDefined();
    expect(retrieved!.operatorId).toBe(OPERATOR_ID);
    expect(retrieved!.reservations.size).toBe(1);
  });

  it("returns undefined when no snapshot exists", () => {
    const retrieved = _getSnapshot(999);
    expect(retrieved).toBeUndefined();
  });

  it("clears snapshot when set to null", () => {
    const snapshot = createSnapshot(OPERATOR_ID, [makeReservation()]);
    _setSnapshot(OPERATOR_ID, snapshot);
    expect(_getSnapshot(OPERATOR_ID)).toBeDefined();

    _setSnapshot(OPERATOR_ID, null);
    expect(_getSnapshot(OPERATOR_ID)).toBeUndefined();
  });

  it("isolates snapshots between different operators", () => {
    const snapshot1 = createSnapshot(1, [
      makeReservation({ reservationId: "res-op1" }),
    ]);
    const snapshot2 = createSnapshot(2, [
      makeReservation({ reservationId: "res-op2-a" }),
      makeReservation({ reservationId: "res-op2-b" }),
    ]);

    _setSnapshot(1, snapshot1);
    _setSnapshot(2, snapshot2);

    expect(_getSnapshot(1)!.reservations.size).toBe(1);
    expect(_getSnapshot(2)!.reservations.size).toBe(2);
  });
});

describe("evaluate-schedule fan-out logic", () => {
  it("would dispatch one event per operator", () => {
    const operatorIds = [1, 2, 3];
    const events = operatorIds.map((operatorId) => ({
      name: "scheduler/schedule.evaluate" as const,
      data: { operatorId },
    }));

    expect(events).toHaveLength(3);
    expect(events[0].data.operatorId).toBe(1);
    expect(events[2].data.operatorId).toBe(3);
    for (const evt of events) {
      expect(evt.name).toBe("scheduler/schedule.evaluate");
      expect(typeof evt.data.operatorId).toBe("number");
    }
  });

  it("produces no events when operator list is empty", () => {
    const operatorIds: number[] = [];
    const events = operatorIds.map((operatorId) => ({
      name: "scheduler/schedule.evaluate" as const,
      data: { operatorId },
    }));

    expect(events).toHaveLength(0);
  });
});

describe("evaluate-schedule per-operator evaluation flow", () => {
  beforeEach(() => {
    _setSnapshot(OPERATOR_ID, null);
  });

  it("first run captures baseline and stores snapshot", () => {
    expect(_getSnapshot(OPERATOR_ID)).toBeUndefined();

    const snapshot = createSnapshot(OPERATOR_ID, [
      makeReservation({ reservationId: "res-001" }),
      makeReservation({ reservationId: "res-002" }),
    ]);
    _setSnapshot(OPERATOR_ID, snapshot);

    const stored = _getSnapshot(OPERATOR_ID);
    expect(stored).toBeDefined();
    expect(stored!.reservations.size).toBe(2);
  });

  it("second run detects cancellations by comparing snapshots", () => {
    const baseline = createSnapshot(OPERATOR_ID, [
      makeReservation({ reservationId: "res-001" }),
      makeReservation({ reservationId: "res-002" }),
      makeReservation({ reservationId: "res-003" }),
    ]);
    _setSnapshot(OPERATOR_ID, baseline);

    const current = createSnapshot(OPERATOR_ID, [
      makeReservation({ reservationId: "res-001" }),
      makeReservation({ reservationId: "res-003" }),
    ]);

    const diff = compareSnapshots(baseline, current);

    expect(diff.cancelled).toHaveLength(1);
    expect(diff.cancelled[0].reservationId).toBe("res-002");

    _setSnapshot(OPERATOR_ID, current);
    expect(_getSnapshot(OPERATOR_ID)!.reservations.size).toBe(2);
  });

  it("retry scenario: FSP API failure should throw for Inngest retry", async () => {
    const failingClient = {
      listReservations: vi.fn().mockRejectedValue(new Error("FSP API timeout")),
    };

    const { CancellationDetector } = await import(
      "@/lib/engine/detection/cancellation-detector"
    );
    const detector = new CancellationDetector(failingClient as never);

    await expect(
      detector.fetchSnapshot(OPERATOR_ID, {
        start: "2026-03-16",
        end: "2026-03-23",
      }),
    ).rejects.toThrow("FSP API timeout");
  });
});
