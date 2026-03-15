// @vitest-environment node
import { describe, it, expect } from "vitest";
import { updateOperatorSettingsSchema } from "@/lib/types/api";

describe("updateOperatorSettingsSchema — customWeights", () => {
  it("accepts valid customWeights array", () => {
    const result = updateOperatorSettingsSchema.safeParse({
      customWeights: [
        {
          name: "Recency bonus",
          signal: "daysSinceLastFlight",
          weight: 3.5,
          enabled: true,
        },
        {
          name: "Hour cap",
          signal: "totalHours",
          weight: 1.0,
          enabled: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty customWeights array", () => {
    const result = updateOperatorSettingsSchema.safeParse({
      customWeights: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects customWeights with invalid signal name", () => {
    const result = updateOperatorSettingsSchema.safeParse({
      customWeights: [
        {
          name: "Bad signal",
          signal: "notARealSignal",
          weight: 1.0,
          enabled: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects customWeights with weight out of range", () => {
    const result = updateOperatorSettingsSchema.safeParse({
      customWeights: [
        {
          name: "Too heavy",
          signal: "totalHours",
          weight: 15,
          enabled: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects customWeights with empty name", () => {
    const result = updateOperatorSettingsSchema.safeParse({
      customWeights: [
        {
          name: "",
          signal: "totalHours",
          weight: 1.0,
          enabled: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("allows omitting customWeights entirely", () => {
    const result = updateOperatorSettingsSchema.safeParse({
      timeSinceLastFlightWeight: 2.0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid signal types", () => {
    const signals = [
      "daysSinceLastFlight",
      "daysUntilExpiry",
      "totalHours",
      "lessonCompletionRate",
    ];

    for (const signal of signals) {
      const result = updateOperatorSettingsSchema.safeParse({
        customWeights: [
          { name: `Test ${signal}`, signal, weight: 1.0, enabled: true },
        ],
      });
      expect(result.success).toBe(true);
    }
  });
});
