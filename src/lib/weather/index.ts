export type {
  FlightCategory,
  WeatherCondition,
  WeatherForecast,
  IWeatherService,
} from "./types";
export { computeFlightCategory } from "./flight-category";
export { MockWeatherProvider } from "./mock-provider";

import type { IWeatherService } from "./types";
import type { WeatherCondition } from "./types";
import { MockWeatherProvider } from "./mock-provider";

export function createWeatherService(
  overrides?: Record<string, Partial<WeatherCondition>>
): IWeatherService {
  // Future: check env for real weather API config
  return new MockWeatherProvider(overrides);
}
