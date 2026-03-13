// ---------------------------------------------------------------------------
// GET /api/prospects/:id — Get prospect request by ID
// PATCH /api/prospects/:id — Update prospect request status
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import {
  getProspectById,
  updateProspectStatus,
} from "@/lib/db/queries/prospects";
import { updateProspectStatusSchema } from "@/lib/types/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const tenant = getTenantFromRequest(request);
    const { id } = await params;

    const prospect = await getProspectById(db, tenant.operatorId, id);

    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ prospect });
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

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const tenant = getTenantFromRequest(request);
    const { id } = await params;

    const body = await request.json();
    const parsed = updateProspectStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const prospect = await getProspectById(db, tenant.operatorId, id);

    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect request not found" },
        { status: 404 }
      );
    }

    await updateProspectStatus(db, tenant.operatorId, id, parsed.data.status);

    return NextResponse.json({
      success: true,
      id,
      status: parsed.data.status,
    });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Invalid prospect status transition")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
