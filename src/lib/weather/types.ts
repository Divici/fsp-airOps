export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR";

export interface WeatherCondition {
  /** Station ICAO code (e.g., "KJFK") */
  stationId: string;
  /** Ceiling in feet AGL. null = clear/unlimited */
  ceiling: number | null;
  /** Visibility in statute miles */
  visibility: number;
  /** Wind speed in knots */
  windSpeed: number;
  /** Wind gust in knots, null if no gusts */
  windGust: number | null;
  /** Computed flight category */
  flightCategory: FlightCategory;
  /** Raw METAR string */
  raw: string;
  /** Observation time */
  observedAt: Date;
}

export interface WeatherForecast {
  /** Forecast valid from */
  validFrom: Date;
  /** Forecast valid to */
  validTo: Date;
  /** Forecast ceiling */
  ceiling: number | null;
  /** Forecast visibility */
  visibility: number;
  /** Forecast flight category */
  flightCategory: FlightCategory;
}

export interface IWeatherService {
  /** Get current conditions for a station */
  getConditions(stationId: string): Promise<WeatherCondition>;
  /** Get forecast (TAF) for next N hours */
  getForecast(
    stationId: string,
    hoursAhead: number
  ): Promise<WeatherForecast[]>;
}
