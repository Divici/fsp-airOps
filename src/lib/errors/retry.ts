// ---------------------------------------------------------------------------
// Retry with exponential backoff and jitter
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000). */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000). */
  maxDelay?: number;
  /** Predicate to decide if an error is retryable. If omitted, all errors retry. */
  retryOn?: (error: unknown) => boolean;
  /** Called before each retry with the attempt number and delay. */
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

/**
 * Execute `fn` with exponential backoff + jitter.
 *
 * Delay formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 * Jitter is a random value between 0 and baseDelay to avoid thundering herd.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30_000;
  const retryOn = options?.retryOn;
  const onRetry = options?.onRetry;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If we've exhausted retries, throw
      if (attempt >= maxRetries) {
        throw error;
      }

      // If the error is not retryable, throw immediately
      if (retryOn && !retryOn(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * baseDelay;
      const delay = Math.min(exponentialDelay + jitter, maxDelay);

      onRetry?.(attempt + 1, delay, error);

      await sleep(delay);
    }
  }

  // Should not reach here, but TypeScript needs it
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
