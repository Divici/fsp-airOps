// ---------------------------------------------------------------------------
// Reschedule Workflow Types
// ---------------------------------------------------------------------------

export interface CancelledReservationContext {
  reservationId: string;
  studentId: string;
  studentName: string;
  instructorId?: string;
  aircraftId?: string;
  activityTypeId: string;
  locationId: number;
  originalStart: string;
  originalEnd: string;
  cancellationReason?: string;
}
