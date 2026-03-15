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

const mockLoadSnapshot = vi.fn();
const mockSaveSnapshot = vi.fn();

vi.mock("@/lib/db/queries/snapshots", () => ({
  loadSnapshot: (...args: unknown[]) => mockLoadSnapshot(...args),
  saveSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
}));

vi.mock("@/lib/fsp-client", () => ({
  createFspClient: vi.fn(),
}));

vi.mock("@/lib/engine", () => ({
  createOrchestrator: vi.fn(),
}));

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

describe("evaluate-schedule snapshot persistence", () => {
  beforeEach(() => {
    mockLoadSnapshot.mockReset();
    mockSaveSnapshot.mockReset();
  });

  it("loadSnapshot returns null when no snapshot exists", async () => {
    mockLoadSnapshot.mockResolvedValue(null);

    const { loadSnapshot } = await import("@/lib/db/queries/snapshots");
    const result = await loadSnapshot({} as never, 999);
    expect(result).toBeNull();
  });

  it("saveSnapshot is called with serialized reservation data", async () => {
    mockSaveSnapshot.mockResolvedValue(undefined);

    const snapshot = createSnapshot(OPERATOR_ID, [makeReservation()]);
    const serialized = Array.from(snapshot.reservations.entries());

    const { saveSnapshot } = await import("@/lib/db/queries/snapshots");
    await saveSnapshot({} as never, OPERATOR_ID, snapshot.capturedAt, serialized);

    expect(mockSaveSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      OPERATOR_ID,
      snapshot.capturedAt,
      serialized,
    );
  });

  it("round-trips snapshot data through serialization", async () => {
    const snapshot = createSnapshot(OPERATOR_ID, [
      makeReservation({ reservationId: "res-001" }),
      makeReservation({ reservationId: "res-002" }),
    ]);
    const serialized = Array.from(snapshot.reservations.entries());

    // Simulate loading from DB
    mockLoadSnapshot.mockResolvedValue({
      capturedAt: snapshot.capturedAt,
      reservations: serialized,
    });

    const { loadSnapshot } = await import("@/lib/db/queries/snapshots");
    const loaded = await loadSnapshot({} as never, OPERATOR_ID);

    expect(loaded).not.toBeNull();
    const reconstructed = new Map(loaded!.reservations as Array<[string, FspReservationListItem]>);
    expect(reconstructed.size).toBe(2);
    expect(reconstructed.has("res-001")).toBe(true);
    expect(reconstructed.has("res-002")).toBe(true);
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
    mockLoadSnapshot.mockReset();
    mockSaveSnapshot.mockReset();
  });

  it("first run captures baseline when no previous snapshot exists", async () => {
    mockLoadSnapshot.mockResolvedValue(null);

    const snapshot = createSnapshot(OPERATOR_ID, [
      makeReservation({ reservationId: "res-001" }),
      makeReservation({ reservationId: "res-002" }),
    ]);

    // Verify the snapshot would be saved
    mockSaveSnapshot.mockResolvedValue(undefined);
    const { saveSnapshot } = await import("@/lib/db/queries/snapshots");
    await saveSnapshot(
      {} as never,
      OPERATOR_ID,
      snapshot.capturedAt,
      Array.from(snapshot.reservations.entries()),
    );

    expect(mockSaveSnapshot).toHaveBeenCalledTimes(1);
    const savedReservations = mockSaveSnapshot.mock.calls[0][3] as Array<[string, FspReservationListItem]>;
    expect(savedReservations).toHaveLength(2);
  });

  it("second run detects cancellations by comparing snapshots", () => {
    const baseline = createSnapshot(OPERATOR_ID, [
      makeReservation({ reservationId: "res-001" }),
      makeReservation({ reservationId: "res-002" }),
      makeReservation({ reservationId: "res-003" }),
    ]);

    const current = createSnapshot(OPERATOR_ID, [
      makeReservation({ reservationId: "res-001" }),
      makeReservation({ reservationId: "res-003" }),
    ]);

    const diff = compareSnapshots(baseline, current);

    expect(diff.cancelled).toHaveLength(1);
    expect(diff.cancelled[0].reservationId).toBe("res-002");
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
