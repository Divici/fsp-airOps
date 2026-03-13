// ---------------------------------------------------------------------------
// Cancellation Detector — Detects cancelled reservations by comparing snapshots
// ---------------------------------------------------------------------------

import type { IFspClient, ReservationListParams } from "@/lib/fsp-client/types";
import type { FspReservationListItem } from "@/lib/types/fsp";
import {
  type ScheduleSnapshot,
  type SnapshotDiff,
  createSnapshot,
  compareSnapshots,
} from "./schedule-snapshot";

export interface DetectedCancellation {
  reservationId: string;
  reservationNumber: number;
  pilotId: string;
  pilotName: string;
  resource: string;
  start: string;
  end: string;
}

export interface DetectionResult {
  operatorId: number;
  cancellations: DetectedCancellation[];
  diff: SnapshotDiff;
  currentSnapshot: ScheduleSnapshot;
}

export class CancellationDetector {
  constructor(private fspClient: IFspClient) {}

  /**
   * Fetch the current schedule and compare against a previous snapshot.
   * Returns detected cancellations and the full diff.
   */
  async detect(
    operatorId: number,
    previousSnapshot: ScheduleSnapshot,
    queryParams: ReservationListParams,
  ): Promise<DetectionResult> {
    const currentReservations = await this.fspClient.listReservations(
      operatorId,
      queryParams,
    );

    const currentSnapshot = createSnapshot(operatorId, currentReservations);
    const diff = compareSnapshots(previousSnapshot, currentSnapshot);

    const cancellations = diff.cancelled.map((r) =>
      toCancellation(r),
    );

    return {
      operatorId,
      cancellations,
      diff,
      currentSnapshot,
    };
  }

  /**
   * Build a snapshot from the current FSP schedule (useful for initial baseline).
   */
  async fetchSnapshot(
    operatorId: number,
    queryParams: ReservationListParams,
  ): Promise<ScheduleSnapshot> {
    const reservations = await this.fspClient.listReservations(
      operatorId,
      queryParams,
    );
    return createSnapshot(operatorId, reservations);
  }
}

function toCancellation(r: FspReservationListItem): DetectedCancellation {
  return {
    reservationId: r.reservationId,
    reservationNumber: r.reservationNumber,
    pilotId: r.pilotId,
    pilotName: `${r.pilotFirstName} ${r.pilotLastName}`,
    resource: r.resource,
    start: r.start,
    end: r.end,
  };
}
