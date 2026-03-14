// ---------------------------------------------------------------------------
// POST /api/settings/reset — Reset operator settings to defaults
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { resetOperatorSettings } from "@/lib/db/queries/operator-settings";
import type { OperatorSettings } from "@/lib/db/schema";

/** Strip internal DB fields from the settings object. */
function toSettingsResponse(s: OperatorSettings) {
  return {
    operatorId: s.operatorId,
    timeSinceLastFlightWeight: s.timeSinceLastFlightWeight,
    timeUntilNextFlightWeight: s.timeUntilNextFlightWeight,
    totalFlightHoursWeight: s.totalFlightHoursWeight,
    preferSameInstructor: s.preferSameInstructor,
    preferSameInstructorWeight: s.preferSameInstructorWeight,
    preferSameAircraft: s.preferSameAircraft,
    preferSameAircraftWeight: s.preferSameAircraftWeight,
    searchWindowDays: s.searchWindowDays,
    topNAlternatives: s.topNAlternatives,
    daylightOnly: s.daylightOnly,
    enabledWorkflows: s.enabledWorkflows,
    communicationPreferences: s.communicationPreferences,
  };
}

export async function POST(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const dbSettings = await resetOperatorSettings(db, tenant.operatorId);

    return NextResponse.json({ settings: toSettingsResponse(dbSettings) });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
