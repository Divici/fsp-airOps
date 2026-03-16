import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AvwxWeatherProvider, extractCeiling } from "../avwx-provider";

// -- Fixtures ----------------------------------------------------------------

const METAR_RESPONSE = [
  {
    icaoId: "KJFK",
    reportTime: "2026-03-16T12:00:00Z",
    temp: 15,
    dewp: 8,
    wdir: 270,
    wspd: 12,
    wgst: 20,
    visib: 10,
    altim: 29.92,
    clouds: [
      { cover: "FEW", base: 5000 },
      { cover: "BKN", base: 8000 },
    ],
    rawOb: "KJFK 161200Z 27012G20KT 10SM FEW050 BKN080 15/08 A2992",
  },
];

const METAR_IFR_RESPONSE = [
  {
    icaoId: "KJFK",
    reportTime: "2026-03-16T14:00:00Z",
    temp: 10,
    dewp: 9,
    wdir: 180,
    wspd: 8,
    wgst: null,
    visib: 2,
    altim: 29.80,
    clouds: [
      { cover: "OVC", base: 600 },
    ],
    rawOb: "KJFK 161400Z 18008KT 2SM OVC006 10/09 A2980",
  },
];

const TAF_RESPONSE = [
  {
    icaoId: "KJFK",
    rawTAF: "TAF KJFK 161200Z ...",
    fcsts: [
      {
        timeFrom: "2026-03-16T12:00:00Z",
        timeTo: "2026-03-16T18:00:00Z",
        wspd: 12,
        wgst: null,
        visib: 10,
        clouds: [{ cover: "FEW", base: 5000 }],
      },
      {
        timeFrom: "2026-03-16T18:00:00Z",
        timeTo: "2026-03-17T00:00:00Z",
        wspd: 8,
        wgst: null,
        visib: 6,
        clouds: [{ cover: "BKN", base: 3000 }],
      },
      {
        timeFrom: "2026-03-17T00:00:00Z",
        timeTo: "2026-03-17T06:00:00Z",
        wspd: 5,
        wgst: null,
        visib: 1,
        clouds: [{ cover: "OVC", base: 300 }],
      },
    ],
  },
];

// -- Helpers -----------------------------------------------------------------

function mockFetchSuccess(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchFailure(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: "Internal Server Error",
    json: () => Promise.resolve(null),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new Error("Network error"));
}

// -- Tests -------------------------------------------------------------------

describe("extractCeiling", () => {
  it("returns null for no clouds", () => {
    expect(extractCeiling([])).toBeNull();
  });

  it("returns null when only FEW/SCT layers", () => {
    expect(
      extractCeiling([
        { cover: "FEW", base: 3000 },
        { cover: "SCT", base: 5000 },
      ]),
    ).toBeNull();
  });

  it("returns the lowest BKN layer", () => {
    expect(
      extractCeiling([
        { cover: "FEW", base: 2000 },
        { cover: "BKN", base: 8000 },
        { cover: "BKN", base: 4000 },
      ]),
    ).toBe(4000);
  });

  it("returns the lowest OVC layer", () => {
    expect(
      extractCeiling([
        { cover: "OVC", base: 600 },
        { cover: "OVC", base: 1200 },
      ]),
    ).toBe(600);
  });

  it("picks the lowest between BKN and OVC", () => {
    expect(
      extractCeiling([
        { cover: "BKN", base: 5000 },
        { cover: "OVC", base: 3000 },
      ]),
    ).toBe(3000);
  });
});

describe("AvwxWeatherProvider", () => {
  let provider: AvwxWeatherProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new AvwxWeatherProvider();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // -- getConditions ---------------------------------------------------------

  describe("getConditions", () => {
    it("parses a METAR response correctly", async () => {
      globalThis.fetch = mockFetchSuccess(METAR_RESPONSE);

      const conditions = await provider.getConditions("KJFK");

      expect(conditions.stationId).toBe("KJFK");
      expect(conditions.ceiling).toBe(8000); // BKN080
      expect(conditions.visibility).toBe(10);
      expect(conditions.windSpeed).toBe(12);
      expect(conditions.windGust).toBe(20);
      expect(conditions.flightCategory).toBe("VFR");
      expect(conditions.raw).toBe(
        "KJFK 161200Z 27012G20KT 10SM FEW050 BKN080 15/08 A2992",
      );
      expect(conditions.observedAt).toEqual(new Date("2026-03-16T12:00:00Z"));
    });

    it("computes IFR flight category from low ceiling and visibility", async () => {
      globalThis.fetch = mockFetchSuccess(METAR_IFR_RESPONSE);

      const conditions = await provider.getConditions("KJFK");

      expect(conditions.ceiling).toBe(600);
      expect(conditions.visibility).toBe(2);
      expect(conditions.flightCategory).toBe("IFR");
    });

    it("returns VFR defaults on HTTP error", async () => {
      globalThis.fetch = mockFetchFailure(503);

      const conditions = await provider.getConditions("KJFK");

      expect(conditions.stationId).toBe("KJFK");
      expect(conditions.flightCategory).toBe("VFR");
      expect(conditions.ceiling).toBeNull();
      expect(conditions.visibility).toBe(10);
      expect(conditions.windSpeed).toBe(0);
      expect(conditions.windGust).toBeNull();
    });

    it("returns VFR defaults on network error", async () => {
      globalThis.fetch = mockFetchNetworkError();

      const conditions = await provider.getConditions("KJFK");

      expect(conditions.stationId).toBe("KJFK");
      expect(conditions.flightCategory).toBe("VFR");
      expect(conditions.ceiling).toBeNull();
    });

    it("returns VFR defaults when API returns empty array", async () => {
      globalThis.fetch = mockFetchSuccess([]);

      const conditions = await provider.getConditions("KXYZ");

      expect(conditions.stationId).toBe("KXYZ");
      expect(conditions.flightCategory).toBe("VFR");
    });

    it("calls the correct METAR API URL", async () => {
      globalThis.fetch = mockFetchSuccess(METAR_RESPONSE);

      await provider.getConditions("KPAO");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://aviationweather.gov/api/data/metar?ids=KPAO&format=json",
      );
    });
  });

  // -- getForecast -----------------------------------------------------------

  describe("getForecast", () => {
    it("parses TAF forecast groups correctly", async () => {
      // Use a fixed "now" that falls within the TAF range
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

      globalThis.fetch = mockFetchSuccess(TAF_RESPONSE);

      const forecasts = await provider.getForecast("KJFK", 24);

      expect(forecasts.length).toBe(3);

      // First period: VFR (FEW050, vis 10)
      expect(forecasts[0].ceiling).toBeNull(); // FEW is not a ceiling
      expect(forecasts[0].visibility).toBe(10);
      expect(forecasts[0].flightCategory).toBe("VFR");
      expect(forecasts[0].validFrom).toEqual(
        new Date("2026-03-16T12:00:00Z"),
      );
      expect(forecasts[0].validTo).toEqual(new Date("2026-03-16T18:00:00Z"));

      // Second period: MVFR (BKN030, vis 6)
      expect(forecasts[1].ceiling).toBe(3000);
      expect(forecasts[1].visibility).toBe(6);
      expect(forecasts[1].flightCategory).toBe("MVFR");

      // Third period: LIFR (OVC003, vis 1)
      expect(forecasts[2].ceiling).toBe(300);
      expect(forecasts[2].visibility).toBe(1);
      expect(forecasts[2].flightCategory).toBe("LIFR");

      vi.useRealTimers();
    });

    it("filters forecast to only hoursAhead window", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

      globalThis.fetch = mockFetchSuccess(TAF_RESPONSE);

      // Only look 8 hours ahead — should exclude the third period (00:00-06:00 next day)
      const forecasts = await provider.getForecast("KJFK", 8);

      expect(forecasts.length).toBe(2);
      expect(forecasts[0].validFrom).toEqual(
        new Date("2026-03-16T12:00:00Z"),
      );
      expect(forecasts[1].validTo).toEqual(new Date("2026-03-17T00:00:00Z"));

      vi.useRealTimers();
    });

    it("returns VFR fallback on HTTP error", async () => {
      globalThis.fetch = mockFetchFailure(500);

      const forecasts = await provider.getForecast("KJFK", 12);

      expect(forecasts).toHaveLength(1);
      expect(forecasts[0].flightCategory).toBe("VFR");
      expect(forecasts[0].ceiling).toBeNull();
      expect(forecasts[0].visibility).toBe(10);
    });

    it("returns VFR fallback on network error", async () => {
      globalThis.fetch = mockFetchNetworkError();

      const forecasts = await provider.getForecast("KJFK", 12);

      expect(forecasts).toHaveLength(1);
      expect(forecasts[0].flightCategory).toBe("VFR");
    });

    it("returns VFR fallback when API returns empty array", async () => {
      globalThis.fetch = mockFetchSuccess([]);

      const forecasts = await provider.getForecast("KJFK", 12);

      expect(forecasts).toHaveLength(1);
      expect(forecasts[0].flightCategory).toBe("VFR");
    });

    it("returns VFR fallback when no fcsts in response", async () => {
      globalThis.fetch = mockFetchSuccess([{ icaoId: "KJFK", fcsts: null }]);

      const forecasts = await provider.getForecast("KJFK", 12);

      expect(forecasts).toHaveLength(1);
      expect(forecasts[0].flightCategory).toBe("VFR");
    });

    it("calls the correct TAF API URL", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

      globalThis.fetch = mockFetchSuccess(TAF_RESPONSE);

      await provider.getForecast("KSQL", 12);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://aviationweather.gov/api/data/taf?ids=KSQL&format=json",
      );

      vi.useRealTimers();
    });
  });
});
