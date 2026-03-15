// ---------------------------------------------------------------------------
// Weather Disruption Workflow Types
// ---------------------------------------------------------------------------

export interface WeatherDisruptionContext {
  reservationId: string;
  studentId: string;
  studentName: string;
  instructorId?: string;
  aircraftId: string;
  locationId: number;
  originalStart: string;
  originalEnd: string;
  reason: string;
  weatherClearsAt: string;
  activityTypeId?: string;
  /** AI-assigned urgency score (0-100). Populated by flight prioritizer. */
  urgencyScore?: number;
  /** AI reasoning for this flight's priority. */
  urgencyReasoning?: string;
}
