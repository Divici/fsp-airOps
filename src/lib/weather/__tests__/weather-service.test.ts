import { describe, it, expect } from "vitest";
import { MockWeatherProvider } from "../mock-provider";
import { createWeatherService } from "../index";
import type { WeatherCondition } from "../types";

describe("MockWeatherProvider", () => {
  describe("getConditions", () => {
    it("returns VFR conditions by default", async () => {
      const provider = new MockWeatherProvider();
      const conditions = await provider.getConditions("KJFK");

      expect(conditions.stationId).toBe("KJFK");
      expect(conditions.ceiling).toBe(5000);
      expect(conditions.visibility).toBe(10);
      expect(conditions.windSpeed).toBe(8);
      expect(conditions.windGust).toBeNull();
      expect(conditions.flightCategory).toBe("VFR");
      expect(conditions.observedAt).toBeInstanceOf(Date);
    });

    it("returns configured conditions for overridden stations", async () => {
      const overrides: Record<string, Partial<WeatherCondition>> = {
        KJFK: {
          ceiling: 400,
          visibility: 0.5,
          windSpeed: 25,
          windGust: 35,
        },
      };
      const provider = new MockWeatherProvider(overrides);
      const conditions = await provider.getConditions("KJFK");

      expect(conditions.stationId).toBe("KJFK");
      expect(conditions.ceiling).toBe(400);
      expect(conditions.visibility).toBe(0.5);
      expect(conditions.windSpeed).toBe(25);
      expect(conditions.windGust).toBe(35);
      expect(conditions.flightCategory).toBe("LIFR");
    });

    it("returns VFR for non-overridden stations when overrides exist", async () => {
      const overrides: Record<string, Partial<WeatherCondition>> = {
        KJFK: { ceiling: 400, visibility: 0.5 },
      };
      const provider = new MockWeatherProvider(overrides);
      const conditions = await provider.getConditions("KLAX");

      expect(conditions.flightCategory).toBe("VFR");
      expect(conditions.ceiling).toBe(5000);
    });
  });

  describe("getForecast", () => {
    it("returns 4 periods of VFR by default", async () => {
      const provider = new MockWeatherProvider();
      const forecast = await provider.getForecast("KJFK", 12);

      expect(forecast).toHaveLength(4);
      for (const period of forecast) {
        expect(period.flightCategory).toBe("VFR");
        expect(period.ceiling).toBe(5000);
        expect(period.visibility).toBe(10);
        expect(period.validFrom).toBeInstanceOf(Date);
        expect(period.validTo).toBeInstanceOf(Date);
      }
    });

    it("returns clearing weather pattern for overridden stations", async () => {
      const overrides: Record<string, Partial<WeatherCondition>> = {
        KJFK: { ceiling: 400, visibility: 0.5 },
      };
      const provider = new MockWeatherProvider(overrides);
      const forecast = await provider.getForecast("KJFK", 12);

      expect(forecast).toHaveLength(4);

      // First 2 periods: bad weather (matches override)
      expect(forecast[0].flightCategory).toBe("LIFR");
      expect(forecast[0].ceiling).toBe(400);
      expect(forecast[0].visibility).toBe(0.5);

      expect(forecast[1].flightCategory).toBe("LIFR");
      expect(forecast[1].ceiling).toBe(400);

      // Last 2 periods: clearing to VFR
      expect(forecast[2].flightCategory).toBe("VFR");
      expect(forecast[2].ceiling).toBe(5000);
      expect(forecast[2].visibility).toBe(10);

      expect(forecast[3].flightCategory).toBe("VFR");
    });

    it("forecast periods are sequential 3-hour blocks", async () => {
      const provider = new MockWeatherProvider();
      const forecast = await provider.getForecast("KJFK", 12);

      for (let i = 0; i < forecast.length - 1; i++) {
        expect(forecast[i].validTo.getTime()).toBe(
          forecast[i + 1].validFrom.getTime()
        );
      }

      // Each period is 3 hours
      const threeHoursMs = 3 * 60 * 60 * 1000;
      for (const period of forecast) {
        expect(period.validTo.getTime() - period.validFrom.getTime()).toBe(
          threeHoursMs
        );
      }
    });
  });
});

describe("createWeatherService", () => {
  it("creates a weather service provider", () => {
    const service = createWeatherService();
    expect(service).toBeDefined();
    expect(typeof service.getConditions).toBe("function");
    expect(typeof service.getForecast).toBe("function");
  });

  it("creates a provider that works with overrides", async () => {
    const service = createWeatherService({
      KJFK: { ceiling: 300, visibility: 0.25 },
    });
    const conditions = await service.getConditions("KJFK");
    expect(conditions.flightCategory).toBe("LIFR");
  });
});
