import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorHandler } from "../error-handler";
import {
  AppError,
  FspApiError,
  WorkflowError,
  ValidationError,
  TenantError,
  ProposalError,
  ErrorCodes,
} from "../types";
import { withRetry } from "../retry";

// ---------------------------------------------------------------------------
// ErrorHandler tests
// ---------------------------------------------------------------------------

describe("ErrorHandler", () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("handle", () => {
    it("handles AppError and returns structured response", () => {
      const error = new AppError("Something went wrong", {
        code: ErrorCodes.UNKNOWN,
        statusCode: 500,
      });

      const response = handler.handle(error);

      expect(response.error).toBe("Something went wrong");
      expect(response.code).toBe(ErrorCodes.UNKNOWN);
      expect(response.statusCode).toBe(500);
    });

    it("handles FspApiError", () => {
      const error = new FspApiError("FSP API returned 503", {
        statusCode: 502,
      });

      const response = handler.handle(error);

      expect(response.error).toBe("FSP API returned 503");
      expect(response.code).toBe(ErrorCodes.FSP_API_ERROR);
      expect(response.statusCode).toBe(502);
    });

    it("handles ValidationError", () => {
      const error = new ValidationError("Invalid input", {
        fields: { email: "Required" },
      });

      const response = handler.handle(error);

      expect(response.error).toBe("Invalid input");
      expect(response.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(response.statusCode).toBe(400);
    });

    it("handles plain Error by masking internal details", () => {
      const error = new Error("Internal database connection failed");

      const response = handler.handle(error);

      expect(response.error).toBe("An unexpected error occurred");
      expect(response.code).toBe(ErrorCodes.UNKNOWN);
      expect(response.statusCode).toBe(500);
    });

    it("handles non-Error values", () => {
      const response = handler.handle("string error");

      expect(response.error).toBe("An unexpected error occurred");
      expect(response.statusCode).toBe(500);
    });
  });

  describe("isRetryable", () => {
    it("marks 5xx AppError as retryable", () => {
      const error = new FspApiError("Service unavailable", {
        statusCode: 503,
      });
      expect(handler.isRetryable(error)).toBe(true);
    });

    it("marks rate-limited error as retryable", () => {
      const error = new FspApiError("Rate limited", {
        code: ErrorCodes.FSP_RATE_LIMITED,
        statusCode: 429,
      });
      expect(handler.isRetryable(error)).toBe(true);
    });

    it("marks timeout error as retryable", () => {
      const error = new WorkflowError("Workflow timed out", {
        code: ErrorCodes.WORKFLOW_TIMEOUT,
        statusCode: 504,
      });
      expect(handler.isRetryable(error)).toBe(true);
    });

    it("marks 4xx validation error as NOT retryable", () => {
      const error = new ValidationError("Bad input");
      expect(handler.isRetryable(error)).toBe(false);
    });

    it("marks tenant error as NOT retryable", () => {
      const error = new TenantError("Unauthorized");
      expect(handler.isRetryable(error)).toBe(false);
    });

    it("marks proposal error as NOT retryable", () => {
      const error = new ProposalError("Proposal already decided", {
        code: ErrorCodes.PROPOSAL_ALREADY_DECIDED,
      });
      expect(handler.isRetryable(error)).toBe(false);
    });

    it("marks network errors (plain Error) as retryable", () => {
      expect(handler.isRetryable(new Error("network error"))).toBe(true);
      expect(handler.isRetryable(new Error("ECONNREFUSED"))).toBe(true);
      expect(handler.isRetryable(new Error("request timeout"))).toBe(true);
      expect(handler.isRetryable(new Error("fetch failed"))).toBe(true);
    });

    it("marks generic plain Error as NOT retryable", () => {
      expect(handler.isRetryable(new Error("null reference"))).toBe(false);
    });
  });

  describe("toApiResponse", () => {
    it("returns operational error message directly", () => {
      const error = new ValidationError("Email is required");

      const response = handler.toApiResponse(error);

      expect(response.error).toBe("Email is required");
      expect(response.statusCode).toBe(400);
    });

    it("masks non-operational error messages", () => {
      const error = new AppError("DB pool exhausted", {
        isOperational: false,
      });

      const response = handler.toApiResponse(error);

      expect(response.error).toBe("An unexpected error occurred");
    });
  });
});

// ---------------------------------------------------------------------------
// withRetry tests
// ---------------------------------------------------------------------------

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow("always fails");

    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("throws immediately when retryOn returns false", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new ValidationError("bad input"));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        retryOn: (err) => !(err instanceof ValidationError),
      })
    ).rejects.toThrow("bad input");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry callback with attempt info", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    await withRetry(fn, { maxRetries: 2, baseDelay: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Error));
  });

  it("respects maxDelay cap", async () => {
    const delays: number[] = [];
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 10,
      maxDelay: 15,
      onRetry: (_attempt, delay) => delays.push(delay),
    });

    // All delays should be <= maxDelay
    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(15);
    }
  });
});
