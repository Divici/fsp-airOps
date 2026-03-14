// ---------------------------------------------------------------------------
// POST /api/triggers/cancellation — Cancellation Trigger Endpoint
// Receives a cancellation event and dispatches it to the orchestration engine.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { triggerCancellationSchema } from "@/lib/types/api";
import { createOrchestrator } from "@/lib/engine";
import { createFspClient } from "@/lib/fsp-client";
import { TriggerService } from "@/lib/engine/trigger-service";

export async function POST(request: Request) {
  try {
    // 1. Resolve tenant from request
    const tenant = getTenantFromRequest(request);

    // 2. Parse and validate body
    const body = await request.json();
    const parsed = triggerCancellationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 3. Create trigger via TriggerService.createAndDispatch()
    const fspClient = createFspClient();
    const orchestrator = createOrchestrator(db, fspClient);
    const triggerService = new TriggerService(db, orchestrator);

    const result = await triggerService.createAndDispatch({
      operatorId: tenant.operatorId,
      type: "cancellation",
      sourceEntityId: data.cancelledReservationId,
      sourceEntityType: "reservation",
      context: {
        // Map API fields to CancelledReservationContext shape
        reservationId: data.cancelledReservationId,
        studentId: data.cancelledStudentId,
        studentName: data.cancelledStudentId, // resolved later if needed
        instructorId: data.cancelledInstructorId,
        aircraftId: data.cancelledAircraftId,
        activityTypeId: "at-1", // default mock activity type
        locationId: data.locationId,
        originalStart: data.originalStart,
        originalEnd: data.originalEnd,
      },
    });

    // 4. Return trigger ID and status
    return NextResponse.json(
      {
        triggerId: result.triggerId,
        dispatched: result.dispatched,
        duplicate: result.duplicate,
      },
      { status: result.duplicate ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Cancellation trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
