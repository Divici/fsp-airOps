// ---------------------------------------------------------------------------
// Weather Disruption Detector — Detects flights affected by bad weather
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client/types";
import type { IWeatherService, WeatherForecast } from "@/lib/weather/types";
import type { FspAircraft } from "@/lib/types/fsp";

export interface AffectedFlight {
  reservationId: string;
  studentId: string;
  studentName: string;
  instructorId?: string;
  aircraftId: string;
  startTime: string;
  endTime: string;
  reason: string;
}

interface BadWeatherWindow {
  start: Date;
  end: Date;
  ceiling: number | null;
  visibility: number;
}

export class WeatherDisruptionDetector {
  constructor(
    private weatherService: IWeatherService,
    private fspClient: IFspClient,
  ) {}

  /**
   * Detect flights affected by weather conditions below minimums.
   */
  async detectAffectedFlights(
    operatorId: number,
    locationIcao: string,
    minCeiling: number,
    minVisibility: number,
  ): Promise<AffectedFlight[]> {
    // 1. Get current weather
    const current = await this.weatherService.getConditions(locationIcao);

    // 2. Get 6-hour forecast
    const forecast = await this.weatherService.getForecast(locationIcao, 6);

    // 3. Determine bad weather windows
    const badWindows = this.findBadWeatherWindows(
      current,
      forecast,
      minCeiling,
      minVisibility,
    );

    if (badWindows.length === 0) {
      return [];
    }

    // 4. Get today's reservations
    const now = new Date();
    const today = this.formatDate(now);
    const tomorrow = this.formatDate(this.addDays(now, 1));

    const locations = await this.fspClient.getLocations(operatorId);
    const location = locations.find((l) => l.code === locationIcao);
    const locationIds = location ? [Number(location.id)] : [];

    const reservations = await this.fspClient.listReservations(operatorId, {
      start: today,
      end: tomorrow,
      locationIds: locationIds.length > 0 ? locationIds : undefined,
    });

    // 5. Get aircraft data to filter simulators
    const aircraft = await this.fspClient.getAircraft(operatorId);
    const aircraftMap = new Map<string, FspAircraft>();
    for (const ac of aircraft) {
      aircraftMap.set(ac.id, ac);
      // Also index by registration/resource string patterns
      aircraftMap.set(ac.registration, ac);
    }

    // 6. Filter to flights overlapping bad weather, excluding simulators
    const affected: AffectedFlight[] = [];

    for (const reservation of reservations) {
      // Check if this is a simulator session
      if (this.isSimulatorSession(reservation.resource, aircraftMap)) {
        continue;
      }

      const resStart = new Date(reservation.start);
      const resEnd = new Date(reservation.end);

      // Check overlap with any bad weather window
      const overlappingWindow = badWindows.find(
        (w) => resStart < w.end && resEnd > w.start,
      );

      if (overlappingWindow) {
        const ceilingStr =
          overlappingWindow.ceiling !== null
            ? `${overlappingWindow.ceiling}ft`
            : "unlimited";
        const visStr = `${overlappingWindow.visibility}SM`;
        const untilStr = this.formatTime(overlappingWindow.end);

        affected.push({
          reservationId: reservation.reservationId,
          studentId: reservation.pilotId,
          studentName: `${reservation.pilotFirstName} ${reservation.pilotLastName}`,
          aircraftId: this.extractAircraftId(reservation.resource, aircraftMap),
          startTime: reservation.start,
          endTime: reservation.end,
          reason: `IFR conditions: ceiling ${ceilingStr}, visibility ${visStr} until ${untilStr}`,
        });
      }
    }

    return affected;
  }

  /**
   * Determine periods where weather is below minimums.
   */
  private findBadWeatherWindows(
    current: { ceiling: number | null; visibility: number; observedAt: Date },
    forecast: WeatherForecast[],
    minCeiling: number,
    minVisibility: number,
  ): BadWeatherWindow[] {
    const windows: BadWeatherWindow[] = [];

    // Check current conditions
    const currentIsBad = this.isBelowMinimums(
      current.ceiling,
      current.visibility,
      minCeiling,
      minVisibility,
    );

    // Build timeline from current + forecast periods
    const periods: Array<{
      start: Date;
      end: Date;
      ceiling: number | null;
      visibility: number;
    }> = [];

    if (forecast.length > 0 && currentIsBad) {
      periods.push({
        start: current.observedAt,
        end: forecast[0].validFrom,
        ceiling: current.ceiling,
        visibility: current.visibility,
      });
    }

    for (const period of forecast) {
      if (
        this.isBelowMinimums(
          period.ceiling,
          period.visibility,
          minCeiling,
          minVisibility,
        )
      ) {
        periods.push({
          start: period.validFrom,
          end: period.validTo,
          ceiling: period.ceiling,
          visibility: period.visibility,
        });
      }
    }

    // Merge contiguous bad periods
    for (const period of periods) {
      const lastWindow = windows[windows.length - 1];
      if (lastWindow && period.start <= lastWindow.end) {
        // Extend existing window — use worst conditions
        lastWindow.end = period.end;
        if (
          period.ceiling !== null &&
          (lastWindow.ceiling === null || period.ceiling < lastWindow.ceiling)
        ) {
          lastWindow.ceiling = period.ceiling;
        }
        if (period.visibility < lastWindow.visibility) {
          lastWindow.visibility = period.visibility;
        }
      } else {
        windows.push({
          start: period.start,
          end: period.end,
          ceiling: period.ceiling,
          visibility: period.visibility,
        });
      }
    }

    return windows;
  }

  private isBelowMinimums(
    ceiling: number | null,
    visibility: number,
    minCeiling: number,
    minVisibility: number,
  ): boolean {
    if (ceiling !== null && ceiling < minCeiling) return true;
    if (visibility < minVisibility) return true;
    return false;
  }

  private isSimulatorSession(
    resource: string,
    aircraftMap: Map<string, FspAircraft>,
  ): boolean {
    // Check by aircraft ID or registration extracted from resource string
    for (const [, ac] of aircraftMap) {
      if (ac.isSimulator && resource.includes(ac.registration)) {
        return true;
      }
    }
    return false;
  }

  private extractAircraftId(
    resource: string,
    aircraftMap: Map<string, FspAircraft>,
  ): string {
    for (const [, ac] of aircraftMap) {
      if (resource.includes(ac.registration)) {
        return ac.id;
      }
    }
    // Fallback: return the resource string
    return resource;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
