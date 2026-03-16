// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DEFAULT_OPERATOR_SETTINGS } from "../defaults";

describe("DEFAULT_OPERATOR_SETTINGS", () => {
  it("defines all expected weight fields", () => {
    expect(DEFAULT_OPERATOR_SETTINGS.timeSinceLastFlightWeight).toBe(1.0);
    expect(DEFAULT_OPERATOR_SETTINGS.timeUntilNextFlightWeight).toBe(1.0);
    expect(DEFAULT_OPERATOR_SETTINGS.totalFlightHoursWeight).toBe(0.5);
    expect(DEFAULT_OPERATOR_SETTINGS.preferSameInstructorWeight).toBe(0.8);
    expect(DEFAULT_OPERATOR_SETTINGS.preferSameAircraftWeight).toBe(0.3);
  });

  it("defines boolean preference fields", () => {
    expect(DEFAULT_OPERATOR_SETTINGS.preferSameInstructor).toBe(true);
    expect(DEFAULT_OPERATOR_SETTINGS.preferSameAircraft).toBe(false);
    expect(DEFAULT_OPERATOR_SETTINGS.daylightOnly).toBe(true);
  });

  it("defines search and alternative settings", () => {
    expect(DEFAULT_OPERATOR_SETTINGS.searchWindowDays).toBe(7);
    expect(DEFAULT_OPERATOR_SETTINGS.topNAlternatives).toBe(5);
  });

  it("enables all workflows by default", () => {
    expect(DEFAULT_OPERATOR_SETTINGS.enabledWorkflows).toEqual({
      reschedule: true,
      discovery_flight: true,
      next_lesson: true,
      waitlist: true,
      inactivity_outreach: true,
      weather_disruption: false,
    });
  });

  it("defines inactivity threshold default", () => {
    expect(DEFAULT_OPERATOR_SETTINGS.inactivityThresholdDays).toBe(7);
  });

  it("enables email but not SMS by default", () => {
    expect(DEFAULT_OPERATOR_SETTINGS.communicationPreferences).toEqual({
      email: true,
      sms: false,
    });
  });
});
