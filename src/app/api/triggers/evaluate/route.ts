// ---------------------------------------------------------------------------
// POST /api/triggers/evaluate — Manual Evaluation Trigger
// Allows operators to manually trigger a schedule evaluation.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { createOrchestrator } from "@/lib/engine";
import { createFspClient } from "@/lib/fsp-client";
import { TriggerService } from "@/lib/engine/trigger-service";

const manualEvaluateSchema = z.object({
  workflowType: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    // 1. Resolve tenant
    const tenant = getTenantFromRequest(request);

    // 2. Parse optional params
    const body = await request.json().catch(() => ({}));
    const parsed = manualEvaluateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 3. Create a 'manual' trigger and dispatch
    const fspClient = createFspClient();
    const orchestrator = createOrchestrator(db, fspClient);
    const triggerService = new TriggerService(db, orchestrator);

    const result = await triggerService.createAndDispatch({
      operatorId: tenant.operatorId,
      type: "manual",
      context: {
        workflowType: data.workflowType,
        ...data.context,
      },
    });

    // 4. Return result
    return NextResponse.json(
      {
        triggerId: result.triggerId,
        dispatched: result.dispatched,
        duplicate: result.duplicate,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Manual evaluation trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
