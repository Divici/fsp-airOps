import { describe, it, expect, vi } from "vitest";
import { FeatureFlagService } from "../feature-flags";
import { DEFAULT_FEATURE_FLAGS } from "../types";

// ---------------------------------------------------------------------------
// Mock DB helper
// ---------------------------------------------------------------------------

function createMockDb(rows: Record<string, unknown>[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FeatureFlagService", () => {
  describe("getFlags", () => {
    it("returns default flags when no operator settings exist", async () => {
      const db = createMockDb([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new FeatureFlagService(db as any);

      const flags = await service.getFlags(1);

      expect(flags).toEqual(DEFAULT_FEATURE_FLAGS);
    });

    it("merges operator overrides with defaults", async () => {
      const db = createMockDb([
        {
          enabledWorkflows: {
            reschedule: false,
            discovery_flight: true,
            next_lesson: true,
            waitlist: false,
          },
          communicationPreferences: {
            email: true,
            sms: true,
          },
        },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new FeatureFlagService(db as any);

      const flags = await service.getFlags(1);

      expect(flags.enableReschedule).toBe(false);
      expect(flags.enableDiscoveryFlight).toBe(true);
      expect(flags.enableNextLesson).toBe(true);
      expect(flags.enableWaitlist).toBe(false);
      expect(flags.enableEmailNotifications).toBe(true);
      expect(flags.enableSmsNotifications).toBe(true);
      // AI rationale keeps default since not in operator settings
      expect(flags.enableAiRationale).toBe(true);
    });

    it("handles partial operator settings", async () => {
      const db = createMockDb([
        {
          enabledWorkflows: { reschedule: false },
          communicationPreferences: null,
        },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new FeatureFlagService(db as any);

      const flags = await service.getFlags(1);

      expect(flags.enableReschedule).toBe(false);
      // Others should keep defaults
      expect(flags.enableDiscoveryFlight).toBe(true);
      expect(flags.enableEmailNotifications).toBe(true);
      expect(flags.enableSmsNotifications).toBe(false);
    });
  });

  describe("isEnabled", () => {
    it("returns true for an enabled flag", async () => {
      const db = createMockDb([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new FeatureFlagService(db as any);

      const result = await service.isEnabled(1, "enableReschedule");
      expect(result).toBe(true);
    });

    it("returns false for a disabled flag via operator override", async () => {
      const db = createMockDb([
        {
          enabledWorkflows: { waitlist: false },
          communicationPreferences: null,
        },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new FeatureFlagService(db as any);

      const result = await service.isEnabled(1, "enableWaitlist");
      expect(result).toBe(false);
    });

    it("returns false for SMS notifications by default", async () => {
      const db = createMockDb([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new FeatureFlagService(db as any);

      const result = await service.isEnabled(1, "enableSmsNotifications");
      expect(result).toBe(false);
    });
  });
});
