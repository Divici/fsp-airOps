// ---------------------------------------------------------------------------
// Discovery Flight Workflow Types
// ---------------------------------------------------------------------------

export interface DiscoveryFlightContext {
  prospectId: string;
  firstName: string;
  lastName: string;
  email: string;
  preferredLocationId?: number;
  preferredDateStart?: string;
  preferredDateEnd?: string;
  preferredTimeWindows?: Array<{ start: string; end: string }>;
}
