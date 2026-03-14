// ---------------------------------------------------------------------------
// Structured Logger — JSON in production, pretty-print in development
// ---------------------------------------------------------------------------

import { CorrelationContext } from "./correlation";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogContext {
  correlationId?: string;
  operatorId?: number;
  workflowType?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId: string;
  [key: string]: unknown;
}

export class Logger {
  private minLevel: LogLevel;
  private isProduction: boolean;

  constructor(opts?: { minLevel?: LogLevel; isProduction?: boolean }) {
    this.minLevel = opts?.minLevel ?? "debug";
    this.isProduction = opts?.isProduction ?? process.env.NODE_ENV === "production";
  }

  log(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const correlationData = CorrelationContext.current();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId:
        context?.correlationId ??
        correlationData?.correlationId ??
        "no-correlation-id",
      ...(context?.operatorId !== undefined || correlationData?.operatorId !== undefined
        ? { operatorId: context?.operatorId ?? correlationData?.operatorId }
        : {}),
      ...(context?.workflowType !== undefined || correlationData?.workflowType !== undefined
        ? { workflowType: context?.workflowType ?? correlationData?.workflowType }
        : {}),
      ...Object.fromEntries(
        Object.entries(context ?? {}).filter(
          ([k]) => !["correlationId", "operatorId", "workflowType"].includes(k)
        )
      ),
    };

    if (this.isProduction) {
      this._writeJson(level, entry);
    } else {
      this._writePretty(level, entry);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }

  /** @internal — exposed for testing */
  _buildEntry(level: LogLevel, message: string, context?: LogContext): LogEntry | null {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return null;
    }

    const correlationData = CorrelationContext.current();

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId:
        context?.correlationId ??
        correlationData?.correlationId ??
        "no-correlation-id",
      ...(context?.operatorId !== undefined || correlationData?.operatorId !== undefined
        ? { operatorId: context?.operatorId ?? correlationData?.operatorId }
        : {}),
      ...(context?.workflowType !== undefined || correlationData?.workflowType !== undefined
        ? { workflowType: context?.workflowType ?? correlationData?.workflowType }
        : {}),
      ...Object.fromEntries(
        Object.entries(context ?? {}).filter(
          ([k]) => !["correlationId", "operatorId", "workflowType"].includes(k)
        )
      ),
    };
  }

  private _writeJson(level: LogLevel, entry: LogEntry): void {
    const stream = level === "error" ? console.error : console.log;
    stream(JSON.stringify(entry));
  }

  private _writePretty(level: LogLevel, entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}`;
    const ctx = Object.entries(entry)
      .filter(([k]) => !["timestamp", "level", "message"].includes(k))
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" ");

    const stream = level === "error" ? console.error : console.log;
    stream(`${prefix}: ${entry.message} ${ctx}`);
  }
}
