// ---------------------------------------------------------------------------
// Prospect Mapper — Converts DB rows to ProspectView shapes
// ---------------------------------------------------------------------------

import type { ProspectRequest } from "@/lib/db/schema";
import type { ProspectView } from "@/lib/types/prospect-view";

/**
 * Map a single prospect DB row to a ProspectView.
 */
export function toProspectView(row: ProspectRequest): ProspectView {
  // Derive preferredDate from the date range (use start date if available)
  const preferredDate = row.preferredDateStart ?? null;

  // Derive preferredTimeOfDay from time windows if present
  let preferredTimeOfDay: string | null = null;
  if (row.preferredTimeWindows) {
    const windows = row.preferredTimeWindows as Array<{
      start: string;
      end: string;
    }>;
    if (windows.length > 0) {
      const firstStart = windows[0].start;
      const hour = parseInt(firstStart.split(":")[0], 10);
      if (hour < 12) preferredTimeOfDay = "morning";
      else if (hour < 17) preferredTimeOfDay = "afternoon";
      else preferredTimeOfDay = "evening";
    }
  }

  return {
    id: row.id,
    operatorId: row.operatorId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    status: row.status!,
    preferredDate,
    preferredTimeOfDay,
    createdAt: row.createdAt.toISOString(),
    linkedProposalId: row.linkedProposalId,
  };
}

/**
 * Map an array of prospect DB rows to ProspectView[].
 */
export function mapProspects(rows: ProspectRequest[]): ProspectView[] {
  return rows.map(toProspectView);
}
