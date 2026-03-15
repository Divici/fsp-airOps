// ---------------------------------------------------------------------------
// GET /api/metrics — Prometheus-compatible metrics export endpoint
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { metrics } from "@/lib/observability";

/**
 * Public metrics endpoint for Prometheus scraping.
 *
 * - Default: returns Prometheus text exposition format (text/plain)
 * - If `Accept: application/json` header is sent, returns JSON snapshot
 */
export async function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";

  if (accept.includes("application/json")) {
    return NextResponse.json(metrics.getMetrics());
  }

  return new Response(metrics.toPrometheusFormat(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
