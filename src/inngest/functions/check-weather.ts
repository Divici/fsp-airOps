// ---------------------------------------------------------------------------
// Inngest Function — Check Weather (Weather Disruption Detection)
//
// Cron function that fans out per operator -> per location, checks weather
// conditions, and creates triggers for affected flights.
// ---------------------------------------------------------------------------

import { inngest } from "../client";
import { db } from "@/lib/db";
import { getActiveOperatorIds } from "@/lib/db/queries/operators";
import { getOperatorSettings } from "@/lib/db/queries/operator-settings";
import { WeatherDisruptionDetector } from "@/lib/engine/detection/weather-detector";
import { TriggerService } from "@/lib/engine/trigger-service";
import { createOrchestrator } from "@/lib/engine";
import { createFspClient } from "@/lib/fsp-client";
import { createWeatherService } from "@/lib/weather";
import { prioritizeFlights } from "@/lib/ai/flight-prioritizer";
import type { FlightForPrioritization } from "@/lib/ai/flight-prioritizer";

// ---------------------------------------------------------------------------
// Cron: Fan-out — runs every 30 minutes, sends one event per operator+location
// ---------------------------------------------------------------------------
export const checkWeatherCron = inngest.createFunction(
  {
    id: "check-weather-cron",
    name: "Check Weather — Fan Out",
  },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    const operatorIds = await step.run("get-active-operators", async () => {
      return getActiveOperatorIds(db);
    });

    if (operatorIds.length === 0) {
      return { message: "No active operators found", checked: 0 };
    }

    // For each operator, get locations and fan out
    const events: Array<{
      name: "scheduler/weather.check";
      data: { operatorId: number; locationIcao: string };
    }> = [];

    for (const operatorId of operatorIds) {
      const settings = await step.run(
        `get-settings-${operatorId}`,
        async () => {
          const s = await getOperatorSettings(db, operatorId);
          return {
            enabledWorkflows: s.enabledWorkflows as Record<string, boolean>,
          };
        },
      );

      // Only check weather if the operator has weather_disruption workflow enabled
      if (!settings.enabledWorkflows?.weather_disruption) {
        continue;
      }

      const locations = await step.run(
        `get-locations-${operatorId}`,
        async () => {
          const fspClient = createFspClient();
          const locs = await fspClient.getLocations(operatorId);
          return locs
            .filter((l) => l.isActive)
            .map((l) => ({ code: l.code }));
        },
      );

      for (const location of locations) {
        events.push({
          name: "scheduler/weather.check" as const,
          data: { operatorId, locationIcao: location.code },
        });
      }
    }

    if (events.length > 0) {
      await step.sendEvent("fan-out-weather-check", events);
    }

    return {
      message: `Dispatched weather checks for ${events.length} operator-location pair(s)`,
      checked: events.length,
    };
  },
);

// ---------------------------------------------------------------------------
// Per-operator-location weather check — triggered by weather.check event
// ---------------------------------------------------------------------------
export const checkOperatorWeather = inngest.createFunction(
  {
    id: "check-operator-weather",
    name: "Check Operator Weather",
    retries: 3,
  },
  { event: "scheduler/weather.check" },
  async ({ event, step }) => {
    const { operatorId, locationIcao } = event.data;

    // Step 1: Load operator settings for weather minimums
    const settings = await step.run("load-operator-settings", async () => {
      const s = await getOperatorSettings(db, operatorId);
      return {
        weatherMinCeiling: (s as Record<string, unknown>).weatherMinCeiling as number ?? 1000,
        weatherMinVisibility: (s as Record<string, unknown>).weatherMinVisibility as number ?? 3,
      };
    });

    // Step 2: Detect affected flights
    const affected = await step.run("detect-affected-flights", async () => {
      const fspClient = createFspClient();
      const weatherService = createWeatherService();
      const detector = new WeatherDisruptionDetector(weatherService, fspClient);

      const flights = await detector.detectAffectedFlights(
        operatorId,
        locationIcao,
        settings.weatherMinCeiling,
        settings.weatherMinVisibility,
      );

      // Serialize for Inngest step transport
      return flights.map((f) => ({ ...f }));
    });

    if (affected.length === 0) {
      return {
        operatorId,
        locationIcao,
        status: "clear",
        affectedFlights: 0,
      };
    }

    // Step 3: Prioritize affected flights using AI
    const prioritized = await step.run(
      "prioritize-affected-flights",
      async () => {
        // Enrich flight data for prioritization
        const flightsForPrioritization: FlightForPrioritization[] =
          affected.map((f) => ({
            reservationId: f.reservationId,
            studentId: f.studentId,
            studentName: f.studentName,
            instructorName: f.instructorId ?? "Unknown",
            startTime: f.startTime,
            daysSinceLastFlight: null, // Not available from detector; AI uses other signals
            trainingStage: undefined,
            checkrideDateDays: null,
            totalFlightHours: undefined,
          }));

        const ranked = await prioritizeFlights(flightsForPrioritization);

        // Serialize for Inngest step transport
        return ranked.map((r) => ({
          ...r,
        }));
      },
    );

    // Step 4: Create triggers for each affected flight in priority order
    const triggerResults = await step.run(
      "create-weather-triggers",
      async () => {
        const fspClient = createFspClient();
        const orchestrator = createOrchestrator(db, fspClient);
        const triggerService = new TriggerService(db, orchestrator);
        const outcomes = [];

        // Build a lookup from prioritized results
        const priorityMap = new Map(
          prioritized.map((p) => [p.reservationId, p]),
        );

        // Process in priority order (prioritized is already sorted by urgency)
        for (const pFlight of prioritized) {
          const flight = affected.find(
            (f) => f.reservationId === pFlight.reservationId,
          );
          if (!flight) continue;

          const priority = priorityMap.get(flight.reservationId);

          const result = await triggerService.createAndDispatch({
            operatorId,
            type: "weather_detected",
            sourceEntityId: flight.reservationId,
            sourceEntityType: "reservation",
            context: {
              reservationId: flight.reservationId,
              studentId: flight.studentId,
              studentName: flight.studentName,
              instructorId: flight.instructorId,
              aircraftId: flight.aircraftId,
              originalStart: flight.startTime,
              originalEnd: flight.endTime,
              reason: flight.reason,
              locationIcao,
              urgencyScore: priority?.urgencyScore,
              urgencyReasoning: priority?.reasoning,
            },
          });

          outcomes.push({
            reservationId: flight.reservationId,
            triggerId: result.triggerId,
            dispatched: result.dispatched,
            duplicate: result.duplicate,
            urgencyScore: priority?.urgencyScore,
          });
        }

        return outcomes;
      },
    );

    return {
      operatorId,
      locationIcao,
      status: "disruptions_detected",
      affectedFlights: affected.length,
      triggers: triggerResults,
    };
  },
);
