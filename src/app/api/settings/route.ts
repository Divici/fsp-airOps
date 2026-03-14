// ---------------------------------------------------------------------------
// GET + PATCH /api/settings — Read and update operator settings
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import {
  getOperatorSettings,
  upsertOperatorSettings,
} from "@/lib/db/queries/operator-settings";
import { updateOperatorSettingsSchema } from "@/lib/types/api";
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

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const dbSettings = await getOperatorSettings(db, tenant.operatorId);

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

export async function PATCH(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const body = await request.json();
    const parsed = updateOperatorSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const dbSettings = await upsertOperatorSettings(
      db,
      tenant.operatorId,
      parsed.data
    );

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
