// ---------------------------------------------------------------------------
// Observability — Barrel exports and singleton instances
// ---------------------------------------------------------------------------

export { Logger } from "./logger";
export type { LogLevel, LogContext, LogEntry } from "./logger";

export { CorrelationContext } from "./correlation";
export type { CorrelationData } from "./correlation";

export { MetricsCollector, METRIC_NAMES } from "./metrics";
export type { MetricTags, MetricsSnapshot } from "./metrics";

// Singleton instances
import { Logger } from "./logger";
import { MetricsCollector } from "./metrics";

export const logger = new Logger();
export const metrics = new MetricsCollector();
