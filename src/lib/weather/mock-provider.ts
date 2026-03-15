import type {
  IWeatherService,
  WeatherCondition,
  WeatherForecast,
} from "./types";
import { computeFlightCategory } from "./flight-category";

const DEFAULT_CONDITION: Omit<WeatherCondition, "stationId" | "observedAt"> = {
  ceiling: 5000,
  visibility: 10,
  windSpeed: 8,
  windGust: null,
  flightCategory: "VFR",
  raw: "METAR AUTO 05010KT 10SM CLR 25/15 A3000",
};

export class MockWeatherProvider implements IWeatherService {
  private overrides: Record<string, Partial<WeatherCondition>>;

  constructor(overrides?: Record<string, Partial<WeatherCondition>>) {
    this.overrides = overrides ?? {};
  }

  async getConditions(stationId: string): Promise<WeatherCondition> {
    const override = this.overrides[stationId];
    const ceiling = override?.ceiling ?? DEFAULT_CONDITION.ceiling;
    const visibility = override?.visibility ?? DEFAULT_CONDITION.visibility;

    return {
      stationId,
      ceiling,
      visibility,
      windSpeed: override?.windSpeed ?? DEFAULT_CONDITION.windSpeed,
      windGust: override?.windGust ?? DEFAULT_CONDITION.windGust,
      flightCategory: computeFlightCategory(ceiling, visibility),
      raw: override?.raw ?? `${stationId} ${DEFAULT_CONDITION.raw}`,
      observedAt: override?.observedAt ?? new Date(),
    };
  }

  async getForecast(
    stationId: string,
    hoursAhead: number
  ): Promise<WeatherForecast[]> {
    const override = this.overrides[stationId];
    const periodCount = 4;
    const periodHours = 3;
    const now = new Date();
    const periods: WeatherForecast[] = [];

    for (let i = 0; i < periodCount; i++) {
      const validFrom = new Date(
        now.getTime() + i * periodHours * 60 * 60 * 1000
      );
      const validTo = new Date(
        now.getTime() + (i + 1) * periodHours * 60 * 60 * 1000
      );

      // First 2 periods use override (if any), last 2 return to VFR
      const useOverride = override && i < 2;
      const ceiling = useOverride
        ? (override.ceiling ?? DEFAULT_CONDITION.ceiling)
        : DEFAULT_CONDITION.ceiling;
      const visibility = useOverride
        ? (override.visibility ?? DEFAULT_CONDITION.visibility)
        : DEFAULT_CONDITION.visibility;

      periods.push({
        validFrom,
        validTo,
        ceiling,
        visibility,
        flightCategory: computeFlightCategory(ceiling, visibility),
      });
    }

    return periods;
  }
}
