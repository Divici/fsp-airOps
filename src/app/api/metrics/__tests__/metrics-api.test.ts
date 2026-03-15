import { describe, it, expect, beforeEach, vi } from "vitest";
import { METRIC_NAMES } from "@/lib/observability/metrics";

// Create a fresh collector for each test suite run.
// We import MetricsCollector directly (not via the barrel) so it's resolved
// before the mock intercepts the barrel module.
import { MetricsCollector } from "@/lib/observability/metrics";

const testCollector = new MetricsCollector();

vi.mock("@/lib/observability", () => ({
  get metrics() {
    return testCollector;
  },
}));

// Import the route handler after mocking
const { GET } = await import("../route");

describe("GET /api/metrics", () => {
  beforeEach(() => {
    testCollector.reset();
  });

  it("returns Prometheus text format by default", async () => {
    testCollector.increment(METRIC_NAMES.PROPOSALS_GENERATED, {}, 3);

    const request = new Request("http://localhost/api/metrics");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; version=0.0.4; charset=utf-8"
    );

    const body = await response.text();
    expect(body).toContain("fsp_proposals_generated_total 3");
    expect(body).toContain("# TYPE fsp_proposals_generated_total counter");
  });

  it("returns JSON snapshot when Accept: application/json", async () => {
    testCollector.increment(METRIC_NAMES.FSP_API_CALLS, {}, 5);
    testCollector.gauge(METRIC_NAMES.PROPOSALS_APPROVED, 2);

    const request = new Request("http://localhost/api/metrics", {
      headers: { Accept: "application/json" },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body.counters).toHaveProperty(METRIC_NAMES.FSP_API_CALLS);
    expect(body.counters[METRIC_NAMES.FSP_API_CALLS].value).toBe(5);
    expect(body.gauges).toHaveProperty(METRIC_NAMES.PROPOSALS_APPROVED);
    expect(body.gauges[METRIC_NAMES.PROPOSALS_APPROVED].value).toBe(2);
  });

  it("represents all well-known metric types in Prometheus output", async () => {
    testCollector.increment(METRIC_NAMES.PROPOSALS_GENERATED);
    testCollector.increment(METRIC_NAMES.PROPOSALS_APPROVED);
    testCollector.increment(METRIC_NAMES.RESERVATIONS_CREATED);
    testCollector.increment(METRIC_NAMES.FSP_API_CALLS);
    testCollector.increment(METRIC_NAMES.FSP_API_ERRORS);
    testCollector.timing(METRIC_NAMES.WORKFLOW_DURATION_MS, 150);

    const request = new Request("http://localhost/api/metrics");
    const response = await GET(request);
    const body = await response.text();

    // All well-known counters
    expect(body).toContain("fsp_proposals_generated_total");
    expect(body).toContain("fsp_proposals_approved_total");
    expect(body).toContain("fsp_reservations_created_total");
    expect(body).toContain("fsp_fsp_api_calls_total");
    expect(body).toContain("fsp_fsp_api_errors_total");

    // Timing metric
    expect(body).toContain("fsp_workflow_duration_ms_count");
    expect(body).toContain("fsp_workflow_duration_ms_sum");
  });

  it("returns valid output for empty metrics", async () => {
    const request = new Request("http://localhost/api/metrics");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.text();
    // Should just be a newline (empty metrics)
    expect(body).toBe("\n");
  });
});
