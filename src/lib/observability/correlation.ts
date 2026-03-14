// ---------------------------------------------------------------------------
// CorrelationContext — Propagates correlation IDs through async operations
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface CorrelationData {
  correlationId: string;
  operatorId?: number;
  workflowType?: string;
}

const storage = new AsyncLocalStorage<CorrelationData>();

export class CorrelationContext {
  /** Create a new correlation context with a fresh UUID. */
  static create(extra?: Omit<CorrelationData, "correlationId">): CorrelationData {
    return {
      correlationId: randomUUID(),
      ...extra,
    };
  }

  /**
   * Extract or create a correlation ID from an incoming request.
   * Looks for the `x-correlation-id` header; falls back to a new UUID.
   */
  static fromRequest(req: {
    headers: { get?(name: string): string | null } | Record<string, string | string[] | undefined>;
  }): CorrelationData {
    let existing: string | null | undefined;

    if (typeof (req.headers as Record<string, unknown>).get === "function") {
      existing = (req.headers as { get(name: string): string | null }).get("x-correlation-id");
    } else {
      const raw = (req.headers as Record<string, string | string[] | undefined>)["x-correlation-id"];
      existing = Array.isArray(raw) ? raw[0] : raw;
    }

    return {
      correlationId: existing || randomUUID(),
    };
  }

  /** Run a callback with the given correlation data in AsyncLocalStorage. */
  static run<T>(data: CorrelationData, fn: () => T): T {
    return storage.run(data, fn);
  }

  /** Get the current correlation data (if inside a run context). */
  static current(): CorrelationData | undefined {
    return storage.getStore();
  }

  /** Get the current correlation ID or generate a new one. */
  static currentId(): string {
    return storage.getStore()?.correlationId ?? randomUUID();
  }
}
