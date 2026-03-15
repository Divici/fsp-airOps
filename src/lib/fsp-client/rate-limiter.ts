// ---------------------------------------------------------------------------
// Sliding Window Rate Limiter
// FSP enforces 60 requests per 60 seconds. We use 55 as default to leave
// a safety buffer of 5 requests.
// ---------------------------------------------------------------------------

export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number = 55,
    private windowMs: number = 60_000,
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    // Remove expired timestamps
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      // Wait until the oldest timestamp expires
      const oldestTimestamp = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldestTimestamp) + 10; // +10ms buffer
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      // Clean up again after waiting
      this.timestamps = this.timestamps.filter(
        (t) => Date.now() - t < this.windowMs,
      );
    }

    this.timestamps.push(Date.now());
  }
}
