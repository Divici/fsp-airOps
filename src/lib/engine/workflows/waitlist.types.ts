// ---------------------------------------------------------------------------
// Waitlist Workflow Types
// ---------------------------------------------------------------------------

export interface WaitlistWorkflowContext {
  /** The cancelled or open slot that triggered this workflow. */
  openingStart: string;
  openingEnd: string;
  locationId: number;
  instructorId?: string;
  aircraftId?: string;
  aircraftType?: string;
  activityTypeId?: string;
  /** FSP timezone offset in minutes (for UTC -> local conversion). */
  timeZoneOffset?: number;
}
