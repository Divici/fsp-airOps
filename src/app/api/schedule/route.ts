// ---------------------------------------------------------------------------
// GET /api/schedule — Fetch schedule events for a date range
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { createFspClient } from "@/lib/fsp-client";

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing required query parameters: start, end" },
        { status: 400 }
      );
    }

    // Basic date format validation (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const fspClient = createFspClient();
    const schedule = await fspClient.getSchedule(tenant.operatorId, {
      start,
      end,
      locationIds: [],
    });

    const events = schedule.results.events.map((event, index) => ({
      id: `evt-${index}-${event.Start}`,
      title: event.Title,
      studentName: event.CustomerName,
      instructorName: event.InstructorName,
      aircraftName: event.AircraftName,
      start: event.Start,
      end: event.End,
      type: event.Title.split(" - ")[0] ?? event.Title,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Schedule API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
