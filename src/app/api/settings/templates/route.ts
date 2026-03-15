// ---------------------------------------------------------------------------
// GET + PATCH /api/settings/templates — Read and update communication templates
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import {
  getOperatorSettings,
  upsertOperatorSettings,
} from "@/lib/db/queries/operator-settings";
import {
  getDefaultTemplates,
  extractTemplateVariables,
} from "@/lib/comms/templates";

const updateTemplatesSchema = z.object({
  templates: z
    .record(
      z.string(),
      z.object({
        subject: z.string(),
        body: z.string(),
      })
    )
    .nullable(),
});

/** Merge operator overrides with defaults for a complete view. */
function mergeWithDefaults(
  operatorTemplates: Record<string, { subject: string; body: string }> | null
) {
  const defaults = getDefaultTemplates();
  const merged: Record<
    string,
    {
      id: string;
      subject: string;
      body: string;
      variables: string[];
      isCustom: boolean;
    }
  > = {};

  for (const [id, template] of Object.entries(defaults)) {
    const custom = operatorTemplates?.[id];
    const source = custom ?? { subject: template.subject ?? "", body: template.body };
    merged[id] = {
      id,
      subject: source.subject,
      body: source.body,
      variables: extractTemplateVariables(template),
      isCustom: !!custom,
    };
  }

  return merged;
}

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);
    const settings = await getOperatorSettings(db, tenant.operatorId);

    return NextResponse.json({
      templates: mergeWithDefaults(settings.communicationTemplates ?? null),
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

export async function PATCH(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);

    const body = await request.json();
    const parsed = updateTemplatesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Validate that template names exist in the default registry
    if (parsed.data.templates) {
      const validIds = new Set(Object.keys(getDefaultTemplates()));
      const invalidIds = Object.keys(parsed.data.templates).filter(
        (id) => !validIds.has(id)
      );
      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            error: "Invalid template IDs",
            details: `Unknown template IDs: ${invalidIds.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const settings = await upsertOperatorSettings(db, tenant.operatorId, {
      communicationTemplates: parsed.data.templates,
    });

    return NextResponse.json({
      templates: mergeWithDefaults(settings.communicationTemplates ?? null),
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
