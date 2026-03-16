export type {
  FlightCategory,
  WeatherCondition,
  WeatherForecast,
  IWeatherService,
} from "./types";
export { computeFlightCategory } from "./flight-category";
export { MockWeatherProvider } from "./mock-provider";
export { AvwxWeatherProvider } from "./avwx-provider";

import type { IWeatherService } from "./types";
import type { WeatherCondition } from "./types";
import { MockWeatherProvider } from "./mock-provider";
import { AvwxWeatherProvider } from "./avwx-provider";

export function createWeatherService(
  overrides?: Record<string, Partial<WeatherCondition>>
): IWeatherService {
  if (process.env.WEATHER_PROVIDER === "real") {
    return new AvwxWeatherProvider();
  }
  return new MockWeatherProvider(overrides);
}
