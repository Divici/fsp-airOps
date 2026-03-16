// ---------------------------------------------------------------------------
// Aviation Weather API Provider
//
// Fetches real METAR/TAF data from aviationweather.gov.
// Never throws — returns VFR defaults on any failure.
// ---------------------------------------------------------------------------

import type {
  IWeatherService,
  WeatherCondition,
  WeatherForecast,
} from "./types";
import { computeFlightCategory } from "./flight-category";

// -- API response shapes (subset of what the API returns) --------------------

interface AvwxCloud {
  cover: string;
  base: number;
}

interface AvwxMetarResponse {
  icaoId: string;
  reportTime: string;
  wspd: number;
  wgst: number | null;
  visib: number;
  clouds: AvwxCloud[];
  rawOb: string;
}

interface AvwxTafForecastGroup {
  timeFrom: string;
  timeTo: string;
  wspd: number;
  wgst: number | null;
  visib: number;
  clouds: AvwxCloud[];
}

interface AvwxTafResponse {
  icaoId: string;
  rawTAF: string;
  fcsts: AvwxTafForecastGroup[];
}

// -- Helpers -----------------------------------------------------------------

const METAR_BASE = "https://aviationweather.gov/api/data/metar";
const TAF_BASE = "https://aviationweather.gov/api/data/taf";

/** Default VFR conditions returned when the API is unavailable. */
const VFR_DEFAULTS: Omit<WeatherCondition, "stationId" | "observedAt"> = {
  ceiling: null,
  visibility: 10,
  windSpeed: 0,
  windGust: null,
  flightCategory: "VFR",
  raw: "",
};

/**
 * Extracts the ceiling (lowest BKN or OVC layer) from a cloud array.
 * Returns null if no BKN/OVC layers are present (unlimited ceiling).
 */
export function extractCeiling(clouds: AvwxCloud[]): number | null {
  const ceilingLayers = clouds.filter(
    (c) => c.cover === "BKN" || c.cover === "OVC",
  );
  if (ceilingLayers.length === 0) return null;
  return Math.min(...ceilingLayers.map((c) => c.base));
}

// -- Provider ----------------------------------------------------------------

export class AvwxWeatherProvider implements IWeatherService {
  async getConditions(stationId: string): Promise<WeatherCondition> {
    try {
      const url = `${METAR_BASE}?ids=${encodeURIComponent(stationId)}&format=json`;
      const res = await fetch(url);

      if (!res.ok) {
        console.error(
          `[AvwxWeatherProvider] METAR fetch failed: ${res.status} ${res.statusText}`,
        );
        return this.defaultConditions(stationId);
      }

      const data: AvwxMetarResponse[] = await res.json();

      if (!data || data.length === 0) {
        console.warn(
          `[AvwxWeatherProvider] No METAR data returned for ${stationId}`,
        );
        return this.defaultConditions(stationId);
      }

      const metar = data[0];
      const ceiling = extractCeiling(metar.clouds ?? []);
      const visibility = metar.visib ?? 10;

      return {
        stationId,
        ceiling,
        visibility,
        windSpeed: metar.wspd ?? 0,
        windGust: metar.wgst ?? null,
        flightCategory: computeFlightCategory(ceiling, visibility),
        raw: metar.rawOb ?? "",
        observedAt: new Date(metar.reportTime),
      };
    } catch (error) {
      console.error("[AvwxWeatherProvider] METAR fetch error:", error);
      return this.defaultConditions(stationId);
    }
  }

  async getForecast(
    stationId: string,
    hoursAhead: number,
  ): Promise<WeatherForecast[]> {
    try {
      const url = `${TAF_BASE}?ids=${encodeURIComponent(stationId)}&format=json`;
      const res = await fetch(url);

      if (!res.ok) {
        console.error(
          `[AvwxWeatherProvider] TAF fetch failed: ${res.status} ${res.statusText}`,
        );
        return this.defaultForecast();
      }

      const data: AvwxTafResponse[] = await res.json();

      if (!data || data.length === 0 || !data[0].fcsts) {
        console.warn(
          `[AvwxWeatherProvider] No TAF data returned for ${stationId}`,
        );
        return this.defaultForecast();
      }

      const taf = data[0];
      const now = Date.now();
      const cutoff = now + hoursAhead * 60 * 60 * 1000;

      const forecasts: WeatherForecast[] = [];

      for (const group of taf.fcsts) {
        const validFrom = new Date(group.timeFrom);
        const validTo = new Date(group.timeTo);

        // Skip periods entirely in the past or entirely beyond the lookahead window
        if (validTo.getTime() <= now || validFrom.getTime() >= cutoff) {
          continue;
        }

        const ceiling = extractCeiling(group.clouds ?? []);
        const visibility = group.visib ?? 10;

        forecasts.push({
          validFrom,
          validTo,
          ceiling,
          visibility,
          flightCategory: computeFlightCategory(ceiling, visibility),
        });
      }

      if (forecasts.length === 0) {
        return this.defaultForecast();
      }

      return forecasts;
    } catch (error) {
      console.error("[AvwxWeatherProvider] TAF fetch error:", error);
      return this.defaultForecast();
    }
  }

  // -- Private helpers -------------------------------------------------------

  private defaultConditions(stationId: string): WeatherCondition {
    return {
      stationId,
      ...VFR_DEFAULTS,
      observedAt: new Date(),
    };
  }

  private defaultForecast(): WeatherForecast[] {
    const now = new Date();
    const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    return [
      {
        validFrom: now,
        validTo: sixHoursLater,
        ceiling: null,
        visibility: 10,
        flightCategory: "VFR",
      },
    ];
  }
}
