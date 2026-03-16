import { describe, it, expect, beforeEach } from "vitest";
import { MockFspClient } from "@/lib/fsp-client/mock";
import { MockWeatherProvider } from "@/lib/weather/mock-provider";
import { WeatherDisruptionDetector } from "../weather-detector";
import type { FspReservationListItem } from "@/lib/types/fsp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPERATOR_ID = 1;
const LOCATION_ICAO = "KPAO";

/**
 * Build a mock provider with IFR conditions at the given station.
 * The mock provider returns IFR for first 2 forecast periods (~6 hours),
 * then VFR for the remaining periods.
 */
function createIfrProvider(stationId: string) {
  return new MockWeatherProvider({
    [stationId]: {
      ceiling: 800,
      visibility: 2,
    },
  });
}

/** Build a VFR-only provider (default conditions). */
function createVfrProvider() {
  return new MockWeatherProvider();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WeatherDisruptionDetector", () => {
  let mockClient: MockFspClient;

  beforeEach(() => {
    mockClient = new MockFspClient();
  });

  it("detects flights during bad weather", async () => {
    // Create a reservation that starts 1 hour from now (within the IFR weather window)
    const now = new Date();
    const soonStart = new Date(now.getTime() + 60 * 60 * 1000);
    const soonEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const reservation: FspReservationListItem = {
      reservationId: "res-wx-001",
      reservationNumber: 99010,
      resource: "N12345 - Cessna 172S",
      start: soonStart.toISOString().slice(0, 19),
      end: soonEnd.toISOString().slice(0, 19),
      pilotFirstName: "Alex",
      pilotLastName: "Rivera",
      pilotId: "stu-aaa-1111",
      status: 1,
    };

    mockClient.listReservations = async () => [reservation];

    const weatherService = createIfrProvider(LOCATION_ICAO);
    const detector = new WeatherDisruptionDetector(weatherService, mockClient);

    const affected = await detector.detectAffectedFlights(
      OPERATOR_ID,
      LOCATION_ICAO,
      1000, // minCeiling
      3, // minVisibility
    );

    expect(affected.length).toBeGreaterThan(0);

    // Each affected flight should have required fields
    for (const flight of affected) {
      expect(flight.reservationId).toBeDefined();
      expect(flight.studentId).toBeDefined();
      expect(flight.studentName).toBeDefined();
      expect(flight.startTime).toBeDefined();
      expect(flight.endTime).toBeDefined();
      expect(flight.reason).toContain("IFR conditions");
    }
  });

  it("returns empty array when VFR conditions", async () => {
    const weatherService = createVfrProvider();
    const detector = new WeatherDisruptionDetector(weatherService, mockClient);

    const affected = await detector.detectAffectedFlights(
      OPERATOR_ID,
      LOCATION_ICAO,
      1000,
      3,
    );

    expect(affected).toHaveLength(0);
  });

  it("excludes simulator flights", async () => {
    // The mock aircraft includes ac-5 which is a simulator (SIM-01, Redbird TD2).
    // Add a reservation using the simulator resource.
    const now = new Date();
    const simReservation: FspReservationListItem = {
      reservationId: "res-sim-001",
      reservationNumber: 99001,
      resource: "SIM-01 - Redbird TD2 Simulator",
      start: new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 19), // 1 hour from now
      end: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 19), // 3 hours from now
      pilotFirstName: "Test",
      pilotLastName: "Student",
      pilotId: "stu-test-sim",
      status: 1,
    };

    // Override listReservations to return only the sim reservation
    const originalList = mockClient.listReservations.bind(mockClient);
    mockClient.listReservations = async () => {
      return [simReservation];
    };

    const weatherService = createIfrProvider(LOCATION_ICAO);
    const detector = new WeatherDisruptionDetector(weatherService, mockClient);

    const affected = await detector.detectAffectedFlights(
      OPERATOR_ID,
      LOCATION_ICAO,
      1000,
      3,
    );

    // The simulator flight should be excluded even though it overlaps with bad weather
    expect(affected).toHaveLength(0);

    // Restore
    mockClient.listReservations = originalList;
  });

  it("does not flag flights after weather clears", async () => {
    // Create a provider where weather clears quickly (only first 2 of 4 periods are IFR)
    const weatherService = createIfrProvider(LOCATION_ICAO);
    const detector = new WeatherDisruptionDetector(weatherService, mockClient);

    // Override listReservations to return a flight far in the future (after weather clears)
    const futureStart = new Date();
    futureStart.setHours(futureStart.getHours() + 24); // 24 hours from now — well past 6-hour forecast
    const futureEnd = new Date(futureStart);
    futureEnd.setHours(futureEnd.getHours() + 2);

    const futureReservation: FspReservationListItem = {
      reservationId: "res-future",
      reservationNumber: 99002,
      resource: "N12345 - Cessna 172S",
      start: futureStart.toISOString().slice(0, 19),
      end: futureEnd.toISOString().slice(0, 19),
      pilotFirstName: "Future",
      pilotLastName: "Pilot",
      pilotId: "stu-future",
      status: 1,
    };

    mockClient.listReservations = async () => [futureReservation];

    const affected = await detector.detectAffectedFlights(
      OPERATOR_ID,
      LOCATION_ICAO,
      1000,
      3,
    );

    // Flight is 24 hours out, forecast only covers ~12 hours of bad weather (first 2 periods)
    // so this flight should NOT be affected
    expect(affected).toHaveLength(0);
  });

  it("includes reason string with ceiling, visibility, and time", async () => {
    // Set up a reservation that overlaps with bad weather
    const now = new Date();
    const soonStart = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now
    const soonEnd = new Date(now.getTime() + 150 * 60 * 1000); // 2.5 hours from now

    const reservation: FspReservationListItem = {
      reservationId: "res-reason-test",
      reservationNumber: 99003,
      resource: "N12345 - Cessna 172S",
      start: soonStart.toISOString().slice(0, 19),
      end: soonEnd.toISOString().slice(0, 19),
      pilotFirstName: "Dave",
      pilotLastName: "Smith",
      pilotId: "stu-dave",
      status: 1,
    };

    mockClient.listReservations = async () => [reservation];

    const weatherService = createIfrProvider(LOCATION_ICAO);
    const detector = new WeatherDisruptionDetector(weatherService, mockClient);

    const affected = await detector.detectAffectedFlights(
      OPERATOR_ID,
      LOCATION_ICAO,
      1000,
      3,
    );

    expect(affected).toHaveLength(1);
    expect(affected[0].reason).toMatch(/ceiling/i);
    expect(affected[0].reason).toMatch(/visibility/i);
    expect(affected[0].studentName).toBe("Dave Smith");
  });
});
