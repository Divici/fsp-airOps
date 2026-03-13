import { describe, it, expect, beforeEach } from "vitest";
import type { FspReservationListItem } from "@/lib/types/fsp";
import { MockFspClient } from "@/lib/fsp-client/mock";
import {
  createSnapshot,
  compareSnapshots,
} from "../schedule-snapshot";
import { CancellationDetector } from "../cancellation-detector";

// ---------------------------------------------------------------------------
// Helpers
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

const OPERATOR_ID = 1;

// ---------------------------------------------------------------------------
// Snapshot comparison tests
// ---------------------------------------------------------------------------

describe("compareSnapshots", () => {
  it("returns empty diff when both snapshots are identical", () => {
    const reservations = [makeReservation()];
    const prev = createSnapshot(OPERATOR_ID, reservations);
    const curr = createSnapshot(OPERATOR_ID, reservations);

    const diff = compareSnapshots(prev, curr);

    expect(diff.cancelled).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it("detects cancelled reservations (present in previous, absent in current)", () => {
    const res1 = makeReservation({ reservationId: "res-001" });
    const res2 = makeReservation({ reservationId: "res-002" });

    const prev = createSnapshot(OPERATOR_ID, [res1, res2]);
    const curr = createSnapshot(OPERATOR_ID, [res1]); // res-002 is gone

    const diff = compareSnapshots(prev, curr);

    expect(diff.cancelled).toHaveLength(1);
    expect(diff.cancelled[0].reservationId).toBe("res-002");
    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it("detects added reservations (absent in previous, present in current)", () => {
    const res1 = makeReservation({ reservationId: "res-001" });
    const res2 = makeReservation({ reservationId: "res-new" });

    const prev = createSnapshot(OPERATOR_ID, [res1]);
    const curr = createSnapshot(OPERATOR_ID, [res1, res2]);

    const diff = compareSnapshots(prev, curr);

    expect(diff.cancelled).toHaveLength(0);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].reservationId).toBe("res-new");
    expect(diff.modified).toHaveLength(0);
  });

  it("detects modified reservations (same ID, different time)", () => {
    const res = makeReservation({ reservationId: "res-001" });
    const resModified = makeReservation({
      reservationId: "res-001",
      start: "2026-03-16T09:00:00", // changed from 08:00 to 09:00
    });

    const prev = createSnapshot(OPERATOR_ID, [res]);
    const curr = createSnapshot(OPERATOR_ID, [resModified]);

    const diff = compareSnapshots(prev, curr);

    expect(diff.cancelled).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].previous.start).toBe("2026-03-16T08:00:00");
    expect(diff.modified[0].current.start).toBe("2026-03-16T09:00:00");
  });

  it("detects modified reservations when resource changes", () => {
    const res = makeReservation({ reservationId: "res-001" });
    const resModified = makeReservation({
      reservationId: "res-001",
      resource: "N67890 - Piper PA-28",
    });

    const prev = createSnapshot(OPERATOR_ID, [res]);
    const curr = createSnapshot(OPERATOR_ID, [resModified]);

    const diff = compareSnapshots(prev, curr);

    expect(diff.modified).toHaveLength(1);
  });

  it("handles empty previous snapshot (all current are new)", () => {
    const res1 = makeReservation({ reservationId: "res-001" });
    const prev = createSnapshot(OPERATOR_ID, []);
    const curr = createSnapshot(OPERATOR_ID, [res1]);

    const diff = compareSnapshots(prev, curr);

    expect(diff.cancelled).toHaveLength(0);
    expect(diff.added).toHaveLength(1);
    expect(diff.modified).toHaveLength(0);
  });

  it("handles empty current snapshot (all previous are cancelled)", () => {
    const res1 = makeReservation({ reservationId: "res-001" });
    const prev = createSnapshot(OPERATOR_ID, [res1]);
    const curr = createSnapshot(OPERATOR_ID, []);

    const diff = compareSnapshots(prev, curr);

    expect(diff.cancelled).toHaveLength(1);
    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it("handles both snapshots empty", () => {
    const prev = createSnapshot(OPERATOR_ID, []);
    const curr = createSnapshot(OPERATOR_ID, []);

    const diff = compareSnapshots(prev, curr);

    expect(diff.cancelled).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it("handles mixed changes (cancelled + added + modified)", () => {
    const res1 = makeReservation({ reservationId: "res-001" });
    const res2 = makeReservation({ reservationId: "res-002" });
    const res3 = makeReservation({ reservationId: "res-003" });
    const res3Modified = makeReservation({
      reservationId: "res-003",
      end: "2026-03-16T12:00:00",
    });
    const res4 = makeReservation({ reservationId: "res-new" });

    const prev = createSnapshot(OPERATOR_ID, [res1, res2, res3]);
    const curr = createSnapshot(OPERATOR_ID, [res1, res3Modified, res4]);

    const diff = compareSnapshots(prev, curr);

    expect(diff.cancelled).toHaveLength(1);
    expect(diff.cancelled[0].reservationId).toBe("res-002");
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].reservationId).toBe("res-new");
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].previous.reservationId).toBe("res-003");
  });
});

// ---------------------------------------------------------------------------
// CancellationDetector tests
// ---------------------------------------------------------------------------

describe("CancellationDetector", () => {
  let mockClient: MockFspClient;
  let detector: CancellationDetector;

  beforeEach(() => {
    mockClient = new MockFspClient();
    detector = new CancellationDetector(mockClient);
  });

  const queryParams = { start: "2026-03-16", end: "2026-03-23" };

  it("fetchSnapshot returns a snapshot of current reservations", async () => {
    const snapshot = await detector.fetchSnapshot(OPERATOR_ID, queryParams);

    expect(snapshot.operatorId).toBe(OPERATOR_ID);
    expect(snapshot.reservations.size).toBeGreaterThan(0);
    expect(snapshot.capturedAt).toBeInstanceOf(Date);
  });

  it("detect finds cancellations when a reservation is removed", async () => {
    // Take a baseline snapshot
    const baseline = await detector.fetchSnapshot(OPERATOR_ID, queryParams);

    // Simulate a cancellation
    mockClient.removeReservation("res-002");

    // Detect changes
    const result = await detector.detect(OPERATOR_ID, baseline, queryParams);

    expect(result.cancellations).toHaveLength(1);
    expect(result.cancellations[0].reservationId).toBe("res-002");
    expect(result.cancellations[0].pilotName).toBe("Jamie Nguyen");
    expect(result.diff.cancelled).toHaveLength(1);
  });

  it("detect returns no cancellations when nothing changed", async () => {
    const baseline = await detector.fetchSnapshot(OPERATOR_ID, queryParams);
    const result = await detector.detect(OPERATOR_ID, baseline, queryParams);

    expect(result.cancellations).toHaveLength(0);
    expect(result.diff.cancelled).toHaveLength(0);
  });

  it("detect handles multiple cancellations", async () => {
    const baseline = await detector.fetchSnapshot(OPERATOR_ID, queryParams);

    mockClient.removeReservation("res-001");
    mockClient.removeReservation("res-003");

    const result = await detector.detect(OPERATOR_ID, baseline, queryParams);

    expect(result.cancellations).toHaveLength(2);
    const ids = result.cancellations.map((c) => c.reservationId);
    expect(ids).toContain("res-001");
    expect(ids).toContain("res-003");
  });

  it("detect returns updated snapshot for next cycle", async () => {
    const baseline = await detector.fetchSnapshot(OPERATOR_ID, queryParams);
    mockClient.removeReservation("res-002");

    const result = await detector.detect(OPERATOR_ID, baseline, queryParams);

    // The current snapshot should not contain the removed reservation
    expect(result.currentSnapshot.reservations.has("res-002")).toBe(false);

    // Using the new snapshot for next detection should show no cancellations
    const result2 = await detector.detect(
      OPERATOR_ID,
      result.currentSnapshot,
      queryParams,
    );
    expect(result2.cancellations).toHaveLength(0);
  });
});
