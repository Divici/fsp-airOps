// ---------------------------------------------------------------------------
// GET /api/audit — List audit events with filtering and pagination
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { queryAuditEvents } from "@/lib/db/queries/audit";
import { mapAuditEvents } from "@/lib/api/mappers/audit-mapper";
import { auditListQuerySchema } from "@/lib/types/api";
import type { AuditEventType } from "@/lib/types/audit";

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const url = new URL(request.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = auditListQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { eventType, startDate, endDate, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const result = await queryAuditEvents(db, {
      operatorId: tenant.operatorId,
      eventType: eventType as AuditEventType | undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      events: mapAuditEvents(result.events),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
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
