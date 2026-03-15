// ---------------------------------------------------------------------------
// MetricsCollector — In-memory metrics for MVP (exportable later)
// ---------------------------------------------------------------------------

export interface MetricTags {
  [key: string]: string;
}

interface CounterEntry {
  type: "counter";
  value: number;
  tags: MetricTags;
}

interface TimingEntry {
  type: "timing";
  values: number[];
  tags: MetricTags;
}

interface GaugeEntry {
  type: "gauge";
  value: number;
  tags: MetricTags;
}

type MetricEntry = CounterEntry | TimingEntry | GaugeEntry;

/** Well-known metric names used throughout the application. */
export const METRIC_NAMES = {
  PROPOSALS_GENERATED: "proposals_generated",
  PROPOSALS_APPROVED: "proposals_approved",
  RESERVATIONS_CREATED: "reservations_created",
  WORKFLOW_DURATION_MS: "workflow_duration_ms",
  FSP_API_CALLS: "fsp_api_calls",
  FSP_API_ERRORS: "fsp_api_errors",
} as const;

function tagsKey(tags: MetricTags): string {
  return Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
}

function compositeKey(metric: string, tags: MetricTags): string {
  const tk = tagsKey(tags);
  return tk ? `${metric}|${tk}` : metric;
}

export interface MetricsSnapshot {
  counters: Record<string, { value: number; tags: MetricTags }>;
  timings: Record<string, { values: number[]; tags: MetricTags }>;
  gauges: Record<string, { value: number; tags: MetricTags }>;
}

export class MetricsCollector {
  private entries = new Map<string, MetricEntry>();

  /** Increment a counter metric by the given amount (default 1). */
  increment(metric: string, tags: MetricTags = {}, amount = 1): void {
    const key = compositeKey(metric, tags);
    const existing = this.entries.get(key);

    if (existing && existing.type === "counter") {
      existing.value += amount;
    } else {
      this.entries.set(key, { type: "counter", value: amount, tags });
    }
  }

  /** Record a timing measurement in milliseconds. */
  timing(metric: string, durationMs: number, tags: MetricTags = {}): void {
    const key = compositeKey(metric, tags);
    const existing = this.entries.get(key);

    if (existing && existing.type === "timing") {
      existing.values.push(durationMs);
    } else {
      this.entries.set(key, { type: "timing", values: [durationMs], tags });
    }
  }

  /** Set a gauge metric to a specific value. */
  gauge(metric: string, value: number, tags: MetricTags = {}): void {
    const key = compositeKey(metric, tags);
    this.entries.set(key, { type: "gauge", value, tags });
  }

  /** Return a snapshot of all current metrics. */
  getMetrics(): MetricsSnapshot {
    const counters: MetricsSnapshot["counters"] = {};
    const timings: MetricsSnapshot["timings"] = {};
    const gauges: MetricsSnapshot["gauges"] = {};

    for (const [key, entry] of this.entries) {
      const metricName = key.split("|")[0];

      switch (entry.type) {
        case "counter":
          counters[metricName] = counters[metricName] ?? { value: 0, tags: entry.tags };
          counters[metricName].value = entry.value;
          break;
        case "timing":
          timings[metricName] = { values: [...entry.values], tags: entry.tags };
          break;
        case "gauge":
          gauges[metricName] = { value: entry.value, tags: entry.tags };
          break;
      }
    }

    return { counters, timings, gauges };
  }

  /** Get counter value for a specific metric + tag combo. */
  getCounter(metric: string, tags: MetricTags = {}): number {
    const key = compositeKey(metric, tags);
    const entry = this.entries.get(key);
    return entry?.type === "counter" ? entry.value : 0;
  }

  /** Get timing values for a specific metric + tag combo. */
  getTimings(metric: string, tags: MetricTags = {}): number[] {
    const key = compositeKey(metric, tags);
    const entry = this.entries.get(key);
    return entry?.type === "timing" ? [...entry.values] : [];
  }

  /** Get gauge value for a specific metric + tag combo. */
  getGauge(metric: string, tags: MetricTags = {}): number | undefined {
    const key = compositeKey(metric, tags);
    const entry = this.entries.get(key);
    return entry?.type === "gauge" ? entry.value : undefined;
  }

  /**
   * Export all metrics in Prometheus text exposition format (v0.0.4).
   *
   * - Counters  → `fsp_<name>_total`  (TYPE counter)
   * - Gauges    → `fsp_<name>`        (TYPE gauge)
   * - Timings   → `fsp_<name>_count`, `_sum`, `_min`, `_max` (TYPE summary)
   */
  toPrometheusFormat(): string {
    const snapshot = this.getMetrics();
    const lines: string[] = [];

    // Counters
    for (const [name, entry] of Object.entries(snapshot.counters)) {
      const pName = toPrometheusName(name) + "_total";
      lines.push(`# HELP fsp_${pName} Counter for ${name}`);
      lines.push(`# TYPE fsp_${pName} counter`);
      lines.push(`fsp_${pName} ${entry.value}`);
    }

    // Gauges
    for (const [name, entry] of Object.entries(snapshot.gauges)) {
      const pName = toPrometheusName(name);
      lines.push(`# HELP fsp_${pName} Gauge for ${name}`);
      lines.push(`# TYPE fsp_${pName} gauge`);
      lines.push(`fsp_${pName} ${entry.value}`);
    }

    // Timings — emitted as summary-style metrics
    for (const [name, entry] of Object.entries(snapshot.timings)) {
      const pName = toPrometheusName(name);
      const count = entry.values.length;
      const sum = entry.values.reduce((a, b) => a + b, 0);
      const min = count > 0 ? Math.min(...entry.values) : 0;
      const max = count > 0 ? Math.max(...entry.values) : 0;

      lines.push(`# HELP fsp_${pName} Timing summary for ${name}`);
      lines.push(`# TYPE fsp_${pName} summary`);
      lines.push(`fsp_${pName}_count ${count}`);
      lines.push(`fsp_${pName}_sum ${sum}`);
      lines.push(`fsp_${pName}_min ${min}`);
      lines.push(`fsp_${pName}_max ${max}`);
    }

    return lines.join("\n") + "\n";
  }

  /** Reset all metrics. */
  reset(): void {
    this.entries.clear();
  }
}

/** Convert a metric name to Prometheus-compatible snake_case. */
function toPrometheusName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
