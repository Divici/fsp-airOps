// ---------------------------------------------------------------------------
// Schedule Snapshot — Types and comparison helpers for detecting schedule changes
// ---------------------------------------------------------------------------

import type { FspReservationListItem } from "@/lib/types/fsp";

/**
 * A point-in-time snapshot of an operator's reservations,
 * keyed by reservationId for O(1) lookup.
 */
export interface ScheduleSnapshot {
  operatorId: number;
  capturedAt: Date;
  reservations: Map<string, FspReservationListItem>;
}

/** Result of comparing two schedule snapshots. */
export interface SnapshotDiff {
  /** Reservations present in previous but absent from current (cancelled). */
  cancelled: FspReservationListItem[];
  /** Reservations present in current but absent from previous (new). */
  added: FspReservationListItem[];
  /** Reservations present in both but with different start/end/resource. */
  modified: {
    previous: FspReservationListItem;
    current: FspReservationListItem;
  }[];
}

/**
 * Build a ScheduleSnapshot from a flat reservation list.
 */
export function createSnapshot(
  operatorId: number,
  reservations: FspReservationListItem[],
): ScheduleSnapshot {
  const map = new Map<string, FspReservationListItem>();
  for (const r of reservations) {
    map.set(r.reservationId, r);
  }
  return {
    operatorId,
    capturedAt: new Date(),
    reservations: map,
  };
}

/**
 * Compare two snapshots and return the diff.
 * Both snapshots must belong to the same operator.
 */
export function compareSnapshots(
  previous: ScheduleSnapshot,
  current: ScheduleSnapshot,
): SnapshotDiff {
  const cancelled: FspReservationListItem[] = [];
  const added: FspReservationListItem[] = [];
  const modified: SnapshotDiff["modified"] = [];

  // Find cancelled and modified
  for (const [id, prevRes] of previous.reservations) {
    const curRes = current.reservations.get(id);
    if (!curRes) {
      cancelled.push(prevRes);
    } else if (hasReservationChanged(prevRes, curRes)) {
      modified.push({ previous: prevRes, current: curRes });
    }
  }

  // Find added
  for (const [id, curRes] of current.reservations) {
    if (!previous.reservations.has(id)) {
      added.push(curRes);
    }
  }

  return { cancelled, added, modified };
}

/** Check whether two reservations differ in meaningful scheduling fields. */
function hasReservationChanged(
  a: FspReservationListItem,
  b: FspReservationListItem,
): boolean {
  return a.start !== b.start || a.end !== b.end || a.resource !== b.resource;
}
