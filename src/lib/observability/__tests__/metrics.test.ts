import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector, METRIC_NAMES } from "../metrics";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("counter increments", () => {
    it("starts at zero and increments", () => {
      expect(collector.getCounter("test_counter")).toBe(0);

      collector.increment("test_counter");
      expect(collector.getCounter("test_counter")).toBe(1);

      collector.increment("test_counter");
      expect(collector.getCounter("test_counter")).toBe(2);
    });

    it("increments by custom amount", () => {
      collector.increment("test_counter", {}, 5);
      expect(collector.getCounter("test_counter")).toBe(5);

      collector.increment("test_counter", {}, 3);
      expect(collector.getCounter("test_counter")).toBe(8);
    });

    it("tracks separate counters by tags", () => {
      collector.increment("api_calls", { method: "GET" });
      collector.increment("api_calls", { method: "POST" });
      collector.increment("api_calls", { method: "GET" });

      expect(collector.getCounter("api_calls", { method: "GET" })).toBe(2);
      expect(collector.getCounter("api_calls", { method: "POST" })).toBe(1);
    });
  });

  describe("timing records", () => {
    it("records timing values", () => {
      collector.timing("response_time", 120);
      collector.timing("response_time", 85);
      collector.timing("response_time", 200);

      const values = collector.getTimings("response_time");
      expect(values).toEqual([120, 85, 200]);
    });

    it("returns empty array for unrecorded metric", () => {
      expect(collector.getTimings("not_tracked")).toEqual([]);
    });

    it("separates timings by tags", () => {
      collector.timing("duration", 100, { endpoint: "/api/a" });
      collector.timing("duration", 200, { endpoint: "/api/b" });

      expect(collector.getTimings("duration", { endpoint: "/api/a" })).toEqual([100]);
      expect(collector.getTimings("duration", { endpoint: "/api/b" })).toEqual([200]);
    });
  });

  describe("gauge set/get", () => {
    it("sets and gets gauge values", () => {
      collector.gauge("active_connections", 42);
      expect(collector.getGauge("active_connections")).toBe(42);

      collector.gauge("active_connections", 38);
      expect(collector.getGauge("active_connections")).toBe(38);
    });

    it("returns undefined for unset gauge", () => {
      expect(collector.getGauge("nope")).toBeUndefined();
    });
  });

  describe("tag filtering", () => {
    it("treats different tag combinations as separate metrics", () => {
      collector.increment(METRIC_NAMES.FSP_API_CALLS, { status: "200" });
      collector.increment(METRIC_NAMES.FSP_API_CALLS, { status: "500" });
      collector.increment(METRIC_NAMES.FSP_API_CALLS, { status: "200" });

      expect(collector.getCounter(METRIC_NAMES.FSP_API_CALLS, { status: "200" })).toBe(2);
      expect(collector.getCounter(METRIC_NAMES.FSP_API_CALLS, { status: "500" })).toBe(1);
    });

    it("tag order does not affect matching", () => {
      collector.increment("test", { a: "1", b: "2" });
      // Tags are sorted internally, so reversed order should still match
      expect(collector.getCounter("test", { b: "2", a: "1" })).toBe(1);
    });
  });

  describe("getMetrics snapshot", () => {
    it("returns all metric types in snapshot", () => {
      collector.increment("c1");
      collector.timing("t1", 100);
      collector.gauge("g1", 50);

      const snapshot = collector.getMetrics();

      expect(snapshot.counters).toHaveProperty("c1");
      expect(snapshot.counters.c1.value).toBe(1);
      expect(snapshot.timings).toHaveProperty("t1");
      expect(snapshot.timings.t1.values).toEqual([100]);
      expect(snapshot.gauges).toHaveProperty("g1");
      expect(snapshot.gauges.g1.value).toBe(50);
    });
  });

  describe("toPrometheusFormat", () => {
    it("formats counters with _total suffix and TYPE comment", () => {
      collector.increment("requests", {}, 42);

      const output = collector.toPrometheusFormat();

      expect(output).toContain("# HELP fsp_requests_total Counter for requests");
      expect(output).toContain("# TYPE fsp_requests_total counter");
      expect(output).toContain("fsp_requests_total 42");
    });

    it("formats gauges without suffix", () => {
      collector.gauge("active_users", 7);

      const output = collector.toPrometheusFormat();

      expect(output).toContain("# HELP fsp_active_users Gauge for active_users");
      expect(output).toContain("# TYPE fsp_active_users gauge");
      expect(output).toContain("fsp_active_users 7");
    });

    it("formats timings with _count, _sum, _min, _max suffixes", () => {
      collector.timing("latency", 100);
      collector.timing("latency", 200);
      collector.timing("latency", 300);

      const output = collector.toPrometheusFormat();

      expect(output).toContain("# HELP fsp_latency Timing summary for latency");
      expect(output).toContain("# TYPE fsp_latency summary");
      expect(output).toContain("fsp_latency_count 3");
      expect(output).toContain("fsp_latency_sum 600");
      expect(output).toContain("fsp_latency_min 100");
      expect(output).toContain("fsp_latency_max 300");
    });

    it("returns only a newline for empty metrics", () => {
      expect(collector.toPrometheusFormat()).toBe("\n");
    });

    it("normalizes camelCase names to snake_case", () => {
      collector.increment("myMetricName");

      const output = collector.toPrometheusFormat();

      expect(output).toContain("fsp_my_metric_name_total");
    });

    it("includes all metric types in a single output", () => {
      collector.increment("c1");
      collector.gauge("g1", 10);
      collector.timing("t1", 50);

      const output = collector.toPrometheusFormat();

      expect(output).toContain("fsp_c1_total");
      expect(output).toContain("fsp_g1 10");
      expect(output).toContain("fsp_t1_count 1");
      expect(output).toContain("fsp_t1_sum 50");
    });
  });

  describe("reset", () => {
    it("clears all metrics", () => {
      collector.increment("c1");
      collector.timing("t1", 100);
      collector.gauge("g1", 50);

      collector.reset();

      expect(collector.getCounter("c1")).toBe(0);
      expect(collector.getTimings("t1")).toEqual([]);
      expect(collector.getGauge("g1")).toBeUndefined();
    });
  });
});
