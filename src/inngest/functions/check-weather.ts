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

    // Step 3: Create triggers for each affected flight
    const triggerResults = await step.run(
      "create-weather-triggers",
      async () => {
        const fspClient = createFspClient();
        const orchestrator = createOrchestrator(db, fspClient);
        const triggerService = new TriggerService(db, orchestrator);
        const outcomes = [];

        for (const flight of affected) {
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
            },
          });

          outcomes.push({
            reservationId: flight.reservationId,
            triggerId: result.triggerId,
            dispatched: result.dispatched,
            duplicate: result.duplicate,
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
