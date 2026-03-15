import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../rate-limiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    const limiter = new RateLimiter(3, 1000);

    // Should resolve immediately for requests under the limit
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    // All three should succeed without delay
    expect(true).toBe(true);
  });

  it("throttles when limit is reached", async () => {
    const limiter = new RateLimiter(2, 1000);

    // Use up the limit
    await limiter.acquire();
    await limiter.acquire();

    // Third request should be delayed
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // Should not resolve immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);

    // Advance past the window so the oldest timestamp expires (+10ms buffer)
    await vi.advanceTimersByTimeAsync(1010);
    await promise;
    expect(resolved).toBe(true);
  });

  it("resets after window passes", async () => {
    const limiter = new RateLimiter(2, 1000);

    // Fill the window
    await limiter.acquire();
    await limiter.acquire();

    // Advance past the full window
    await vi.advanceTimersByTimeAsync(1001);

    // Should be able to acquire again without waiting
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(resolved).toBe(true);
  });
});
