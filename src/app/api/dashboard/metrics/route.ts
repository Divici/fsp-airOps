// ---------------------------------------------------------------------------
// GET /api/dashboard/metrics — Dashboard overview metrics and recent activity
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { getDashboardMetrics } from "@/lib/db/queries/dashboard";

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const { metrics, recentActivity } = await getDashboardMetrics(
      db,
      tenant.operatorId
    );

    return NextResponse.json({ metrics, recentActivity });
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
