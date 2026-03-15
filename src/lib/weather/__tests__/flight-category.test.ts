import { describe, it, expect } from "vitest";
import { computeFlightCategory } from "../flight-category";

describe("computeFlightCategory", () => {
  describe("VFR", () => {
    it("returns VFR for high ceiling and good visibility", () => {
      expect(computeFlightCategory(5000, 10)).toBe("VFR");
    });

    it("returns VFR for null (unlimited) ceiling with good visibility", () => {
      expect(computeFlightCategory(null, 10)).toBe("VFR");
    });

    it("returns VFR at ceiling 3001ft and visibility 5.1SM", () => {
      expect(computeFlightCategory(3001, 5.1)).toBe("VFR");
    });
  });

  describe("MVFR", () => {
    it("returns MVFR for ceiling at 3000ft", () => {
      expect(computeFlightCategory(3000, 10)).toBe("MVFR");
    });

    it("returns MVFR for ceiling at 1000ft", () => {
      expect(computeFlightCategory(1000, 10)).toBe("MVFR");
    });

    it("returns MVFR for visibility at 5SM", () => {
      expect(computeFlightCategory(5000, 5)).toBe("MVFR");
    });

    it("returns MVFR for visibility at 3SM", () => {
      expect(computeFlightCategory(5000, 3)).toBe("MVFR");
    });

    it("returns MVFR for null ceiling with visibility 4SM", () => {
      expect(computeFlightCategory(null, 4)).toBe("MVFR");
    });
  });

  describe("IFR", () => {
    it("returns IFR for ceiling at 999ft", () => {
      expect(computeFlightCategory(999, 10)).toBe("IFR");
    });

    it("returns IFR for ceiling at 500ft", () => {
      expect(computeFlightCategory(500, 10)).toBe("IFR");
    });

    it("returns IFR for visibility at 2.99SM", () => {
      expect(computeFlightCategory(5000, 2.99)).toBe("IFR");
    });

    it("returns IFR for visibility at 1SM", () => {
      expect(computeFlightCategory(5000, 1)).toBe("IFR");
    });

    it("returns IFR for null ceiling with visibility 2SM", () => {
      expect(computeFlightCategory(null, 2)).toBe("IFR");
    });
  });

  describe("LIFR", () => {
    it("returns LIFR for ceiling at 499ft", () => {
      expect(computeFlightCategory(499, 10)).toBe("LIFR");
    });

    it("returns LIFR for ceiling at 0ft", () => {
      expect(computeFlightCategory(0, 10)).toBe("LIFR");
    });

    it("returns LIFR for visibility at 0.99SM", () => {
      expect(computeFlightCategory(5000, 0.99)).toBe("LIFR");
    });

    it("returns LIFR for visibility at 0SM", () => {
      expect(computeFlightCategory(5000, 0)).toBe("LIFR");
    });

    it("returns LIFR for null ceiling with visibility 0.5SM", () => {
      expect(computeFlightCategory(null, 0.5)).toBe("LIFR");
    });
  });

  describe("lowest category wins", () => {
    it("returns LIFR when ceiling is VFR but visibility is LIFR", () => {
      expect(computeFlightCategory(5000, 0.5)).toBe("LIFR");
    });

    it("returns LIFR when visibility is VFR but ceiling is LIFR", () => {
      expect(computeFlightCategory(200, 10)).toBe("LIFR");
    });

    it("returns IFR when ceiling is MVFR but visibility is IFR", () => {
      expect(computeFlightCategory(2000, 2)).toBe("IFR");
    });
  });
});
