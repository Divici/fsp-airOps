import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger } from "../logger";
import { CorrelationContext } from "../correlation";

describe("Logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("structured output format", () => {
    it("includes timestamp, level, message, and correlationId", () => {
      const logger = new Logger({ isProduction: true });
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info("test message", { correlationId: "abc-123" });

      expect(spy).toHaveBeenCalledOnce();
      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output).toMatchObject({
        level: "info",
        message: "test message",
        correlationId: "abc-123",
      });
      expect(output.timestamp).toBeDefined();
    });

    it("outputs valid JSON in production mode", () => {
      const logger = new Logger({ isProduction: true });
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info("json check", { correlationId: "c-1" });

      expect(() => JSON.parse(spy.mock.calls[0][0] as string)).not.toThrow();
    });

    it("includes extra context fields in the log entry", () => {
      const logger = new Logger({ isProduction: true });
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info("with context", {
        correlationId: "c-2",
        operatorId: 42,
        workflowType: "reschedule",
        customField: "hello",
      });

      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.operatorId).toBe(42);
      expect(output.workflowType).toBe("reschedule");
      expect(output.customField).toBe("hello");
    });

    it("uses console.error for error level", () => {
      const logger = new Logger({ isProduction: true });
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.error("something broke", { correlationId: "c-3" });

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("correlation ID propagation", () => {
    it("picks up correlation ID from AsyncLocalStorage", () => {
      const logger = new Logger({ isProduction: true });
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const data = { correlationId: "async-id-456", operatorId: 10 };
      CorrelationContext.run(data, () => {
        logger.info("inside context");
      });

      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.correlationId).toBe("async-id-456");
      expect(output.operatorId).toBe(10);
    });

    it("explicit context overrides AsyncLocalStorage values", () => {
      const logger = new Logger({ isProduction: true });
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      CorrelationContext.run({ correlationId: "async-id" }, () => {
        logger.info("override test", { correlationId: "explicit-id" });
      });

      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.correlationId).toBe("explicit-id");
    });

    it("falls back to 'no-correlation-id' when nothing is set", () => {
      const logger = new Logger({ isProduction: true });
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info("no context");

      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.correlationId).toBe("no-correlation-id");
    });
  });

  describe("level filtering", () => {
    it("filters out logs below minimum level", () => {
      const logger = new Logger({ minLevel: "warn", isProduction: true });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.debug("should not appear");
      logger.info("should not appear");
      logger.warn("should appear");
      logger.error("should appear");

      expect(logSpy).toHaveBeenCalledTimes(1); // warn
      expect(errorSpy).toHaveBeenCalledTimes(1); // error
    });

    it("_buildEntry returns null for filtered levels", () => {
      const logger = new Logger({ minLevel: "error" });

      expect(logger._buildEntry("debug", "nope")).toBeNull();
      expect(logger._buildEntry("info", "nope")).toBeNull();
      expect(logger._buildEntry("warn", "nope")).toBeNull();
      expect(logger._buildEntry("error", "yes")).not.toBeNull();
    });
  });

  describe("convenience methods", () => {
    it("debug/info/warn/error all call log with correct level", () => {
      const logger = new Logger({ isProduction: true });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.debug("d", { correlationId: "x" });
      logger.info("i", { correlationId: "x" });
      logger.warn("w", { correlationId: "x" });
      logger.error("e", { correlationId: "x" });

      const debugOut = JSON.parse(logSpy.mock.calls[0][0] as string);
      const infoOut = JSON.parse(logSpy.mock.calls[1][0] as string);
      const warnOut = JSON.parse(logSpy.mock.calls[2][0] as string);
      const errorOut = JSON.parse(errorSpy.mock.calls[0][0] as string);

      expect(debugOut.level).toBe("debug");
      expect(infoOut.level).toBe("info");
      expect(warnOut.level).toBe("warn");
      expect(errorOut.level).toBe("error");
    });
  });
});
