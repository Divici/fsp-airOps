import { describe, it, expect } from "vitest";
import { validateTransition, assertTransition } from "../proposal-lifecycle";
import type { ProposalStatus } from "@/lib/types/domain";

describe("proposal-lifecycle", () => {
  describe("validateTransition", () => {
    const validCases: [ProposalStatus, ProposalStatus][] = [
      ["draft", "pending"],
      ["pending", "approved"],
      ["pending", "declined"],
      ["pending", "expired"],
      ["approved", "executed"],
      ["approved", "failed"],
      ["failed", "pending"],
    ];

    it.each(validCases)(
      "allows transition from '%s' to '%s'",
      (from, to) => {
        expect(validateTransition(from, to)).toBe(true);
      }
    );

    const invalidCases: [ProposalStatus, ProposalStatus][] = [
      // Terminal states cannot transition
      ["declined", "pending"],
      ["expired", "pending"],
      ["executed", "pending"],
      // Cannot skip steps
      ["draft", "approved"],
      ["draft", "executed"],
      ["pending", "executed"],
      // Cannot go backwards
      ["approved", "pending"],
      ["approved", "draft"],
      // Expired cannot be approved
      ["expired", "approved"],
    ];

    it.each(invalidCases)(
      "rejects transition from '%s' to '%s'",
      (from, to) => {
        expect(validateTransition(from, to)).toBe(false);
      }
    );
  });

  describe("assertTransition", () => {
    it("does not throw for valid transitions", () => {
      expect(() => assertTransition("pending", "approved")).not.toThrow();
    });

    it("throws for invalid transitions", () => {
      expect(() => assertTransition("expired", "approved")).toThrow(
        "Invalid proposal status transition: 'expired' -> 'approved'"
      );
    });

    it("throws for declined to any state", () => {
      const targets: ProposalStatus[] = [
        "draft",
        "pending",
        "approved",
        "expired",
        "executed",
        "failed",
      ];

      for (const target of targets) {
        expect(() => assertTransition("declined", target)).toThrow();
      }
    });

    it("allows retry from failed back to pending", () => {
      expect(() => assertTransition("failed", "pending")).not.toThrow();
    });
  });
});
