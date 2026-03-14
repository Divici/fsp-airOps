// ---------------------------------------------------------------------------
// ErrorHandler — centralized error handling, classification, and formatting
// ---------------------------------------------------------------------------

import { AppError, ErrorCodes } from "./types";
import type { ErrorCode } from "./types";

export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
  statusCode: number;
}

export class ErrorHandler {
  /**
   * Handle an error: log it and return a safe API response.
   */
  handle(error: unknown): ApiErrorResponse {
    const appError = this.normalize(error);

    // Log operational errors at warn level, programming errors at error level
    if (appError.isOperational) {
      console.warn(
        `[ErrorHandler] ${appError.name}: ${appError.message}`,
        { code: appError.code, statusCode: appError.statusCode }
      );
    } else {
      console.error(
        `[ErrorHandler] Unexpected error: ${appError.message}`,
        { code: appError.code, statusCode: appError.statusCode },
        appError
      );
    }

    return this.toApiResponse(appError);
  }

  /**
   * Determine if an error is retryable.
   * Network errors, timeouts, and 5xx responses are retryable.
   */
  isRetryable(error: unknown): boolean {
    if (error instanceof AppError) {
      // 5xx errors are retryable
      if (error.statusCode >= 500) return true;
      // Rate limits are retryable
      if (error.code === ErrorCodes.FSP_RATE_LIMITED) return true;
      // Timeouts are retryable
      if (error.code === ErrorCodes.WORKFLOW_TIMEOUT) return true;
      return false;
    }

    // Native network-like errors are retryable
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("econnrefused") ||
        msg.includes("econnreset") ||
        msg.includes("fetch failed")
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Convert an error to a safe API response (no internal details leaked).
   */
  toApiResponse(error: unknown): ApiErrorResponse {
    const appError = this.normalize(error);

    return {
      error: appError.isOperational
        ? appError.message
        : "An unexpected error occurred",
      code: appError.code,
      statusCode: appError.statusCode,
    };
  }

  /**
   * Normalize any thrown value to an AppError.
   */
  private normalize(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, {
        code: ErrorCodes.UNKNOWN,
        statusCode: 500,
        isOperational: false,
        cause: error,
      });
    }

    return new AppError(String(error), {
      code: ErrorCodes.UNKNOWN,
      statusCode: 500,
      isOperational: false,
    });
  }
}
