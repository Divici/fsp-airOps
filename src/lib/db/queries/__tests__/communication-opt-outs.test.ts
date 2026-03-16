// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the database layer
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

// Chainable mock helpers
function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  Object.assign(chain, overrides);
  return chain;
}

const mockDb = {
  select: (...args: unknown[]) => {
    mockSelect(...args);
    return chainable();
  },
  insert: (...args: unknown[]) => {
    mockInsert(...args);
    return chainable();
  },
  delete: (...args: unknown[]) => {
    mockDelete(...args);
    return chainable();
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

import {
  isOptedOut,
  optOut,
  optIn,
  getOptOutStatus,
} from "../communication-opt-outs";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("communication-opt-outs queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isOptedOut", () => {
    it("returns false when no opt-out record exists", async () => {
      const result = await isOptedOut(mockDb, 1, "student-1", "email");
      expect(result).toBe(false);
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it("returns true when an opt-out record exists", async () => {
      // Override the mock to return a row
      const selectChain = chainable({
        limit: vi.fn().mockResolvedValue([{ id: "uuid-1" }]),
      });
      const dbWithRow = {
        ...mockDb,
        select: () => selectChain,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = await isOptedOut(dbWithRow, 1, "student-1", "email");
      expect(result).toBe(true);
    });
  });

  describe("optOut", () => {
    it("inserts an opt-out record with onConflictDoNothing", async () => {
      await optOut(mockDb, 1, "student-1", "email");
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("optIn", () => {
    it("deletes the opt-out record", async () => {
      await optIn(mockDb, 1, "student-1", "sms");
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("getOptOutStatus", () => {
    it("returns both channels as false when no opt-outs exist", async () => {
      // Default mock returns empty array for the where chain
      const selectChain = chainable({
        where: vi.fn().mockResolvedValue([]),
      });
      const dbEmpty = {
        ...mockDb,
        select: () => selectChain,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = await getOptOutStatus(dbEmpty, 1, "student-1");
      expect(result).toEqual({ email: false, sms: false });
    });

    it("returns correct status when email is opted out", async () => {
      const selectChain = chainable({
        where: vi.fn().mockResolvedValue([{ channel: "email" }]),
      });
      const dbEmail = {
        ...mockDb,
        select: () => selectChain,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = await getOptOutStatus(dbEmail, 1, "student-1");
      expect(result).toEqual({ email: true, sms: false });
    });

    it("returns correct status when both channels are opted out", async () => {
      const selectChain = chainable({
        where: vi
          .fn()
          .mockResolvedValue([{ channel: "email" }, { channel: "sms" }]),
      });
      const dbBoth = {
        ...mockDb,
        select: () => selectChain,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = await getOptOutStatus(dbBoth, 1, "student-1");
      expect(result).toEqual({ email: true, sms: true });
    });
  });
});
