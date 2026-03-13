// ---------------------------------------------------------------------------
// POST /api/triggers/lesson-completion — Lesson Completion Trigger Endpoint
// Receives a lesson completion event and dispatches it to the orchestration
// engine to schedule the next lesson.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { triggerLessonCompletionSchema } from "@/lib/types/api";
import { createOrchestrator } from "@/lib/engine";
import { createFspClient } from "@/lib/fsp-client";
import { TriggerService } from "@/lib/engine/trigger-service";

export async function POST(request: Request) {
  try {
    // 1. Resolve tenant from request
    const tenant = getTenantFromRequest(request);

    // 2. Parse and validate body
    const body = await request.json();
    const parsed = triggerLessonCompletionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // 3. Create trigger via TriggerService.createAndDispatch()
    const fspClient = createFspClient();
    const orchestrator = createOrchestrator(db, fspClient);
    const triggerService = new TriggerService(db, orchestrator);

    const result = await triggerService.createAndDispatch({
      operatorId: tenant.operatorId,
      type: "lesson_complete",
      sourceEntityId: data.completedEventId,
      sourceEntityType: "schedulable_event",
      context: {
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        completedEventId: data.completedEventId,
        completedInstructorId: data.completedInstructorId,
      },
    });

    // 4. Return trigger ID and status
    return NextResponse.json(
      {
        triggerId: result.triggerId,
        dispatched: result.dispatched,
        duplicate: result.duplicate,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("Lesson completion trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
