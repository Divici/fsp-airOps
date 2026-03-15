# Phase 2 Features Plan — Inactive Student Outreach & Weather Disruptions

Last updated: 2026-03-15

## Context

PRD Phase 2 defines three features. One (auto-approval) is already built. The remaining two — **inactive student outreach** and **weather disruption adjustments** — can be built now with mock data and swapped to real FSP data later.

This plan also covers three cross-cutting AI enhancements that add genuine value across all workflows.

---

## Feature 1: Inactive Student Outreach

**PRD:** "Detect students with no upcoming flights; propose slots aligned to their availability."

### Architecture

```
Cron (every 6 hours)
  → InactivityDetector.scan(operatorId)         [deterministic]
    → For each inactive student:
      → NextLessonResolver.getNextLesson()       [deterministic — reuse existing]
      → FSP Find-a-Time for available slots      [deterministic — reuse existing]
      → AI: rank slots by student preferences    [AI value-add #1]
      → AI: generate personalized outreach msg   [AI value-add #2]
      → ProposalBuilder.build() → proposal       [deterministic — reuse existing]
      → Auto-approver evaluates                  [AI — already built]
```

### Tasks

#### Task 1.1: InactivityDetector
**File:** `src/lib/engine/detection/inactivity-detector.ts`

- Query FSP `getSchedule()` for each operator
- Find students with no reservation in the past N days (configurable, default 7) AND no upcoming reservation in the next N days (default 7)
- Cross-reference with `getUsers()` to filter only active students
- Return `InactiveStudent[]` with: `studentId`, `lastFlightDate`, `daysSinceLastFlight`, `enrollmentStatus`
- Mock: works immediately — mock schedule + mock students already have this data

#### Task 1.2: Inactivity Workflow
**File:** `src/lib/engine/workflows/inactivity-outreach.ts`

- Register as workflow type `"inactivity_outreach"` in the workflow registry
- Input: `InactiveStudent` + operator settings
- Steps:
  1. Call `NextLessonResolver` to determine what lesson is next (reuse existing)
  2. Call FSP `findAvailableSlots()` to get candidate times (reuse existing)
  3. Call AI slot ranker to pick the best slot considering student's historical patterns (new — see Task 1.5)
  4. Build proposal with personalized rationale via AI (new — see Task 1.6)
- Output: `Proposal` with actions

#### Task 1.3: Inngest Cron Function
**File:** `src/inngest/functions/detect-inactivity.ts`

- Cron: `0 */6 * * *` (every 6 hours)
- Fan-out per operator (same pattern as `evaluateScheduleCron`)
- For each operator: run InactivityDetector → create triggers → dispatch workflows
- Add `"inactivity_detected"` event type to `src/inngest/events.ts`

#### Task 1.4: Operator Settings — Inactivity Threshold
- Add `inactivityThresholdDays: number` (default 7) to operator settings schema
- Add UI control in Settings page (slider, 3-30 days)
- Add to `enabledWorkflows` map: `inactivity_outreach: boolean`

#### Task 1.5: AI Slot Ranker (AI Value-Add #1)
**File:** `src/lib/ai/slot-ranker.ts`

- Input: candidate slots + student history (past booking times, preferred days, instructor history)
- Uses OpenAI to rank slots by soft signals:
  - Student's typical time-of-day preference (derived from past bookings)
  - Instructor continuity (same instructor as recent flights)
  - Recency of availability (sooner is better for inactive students)
- Output: ranked slots with scores + reasoning
- Fallback: deterministic ranking by instructor continuity + soonest-available if OpenAI is unavailable
- Used by: inactivity outreach AND can be adopted by other workflows later

#### Task 1.6: AI Personalized Outreach Message (AI Value-Add #2)
**File:** `src/lib/ai/outreach-message-generator.ts`

- Input: student name, days since last flight, next lesson type, proposed slot details, operator name
- Uses OpenAI to generate a warm, personalized outreach message
- Tone: encouraging, not pushy. Mention specific context (e.g., "Your Stage 3 checkride is coming up")
- Output: `{ subject: string, body: string }`
- Fallback: use the standard template from `templates.ts` if OpenAI fails
- Used by: inactivity outreach email/SMS notifications

#### Task 1.7: Mock Data for Inactivity
- Add 2-3 students in mock schedule data with no recent or upcoming flights
- Ensure InactivityDetector finds them during testing

#### Task 1.8: UI — Inactivity Proposals in Queue
- Add `"inactivity_outreach"` to `WorkflowBadge` component (new color/icon)
- Proposals appear in the normal approval queue — no new UI page needed
- Activity feed shows `"inactivity_detected"` events

---

## Feature 2: Weather Disruption Adjustments

**PRD:** "Weather advisories trigger suggested time/instructor/aircraft swaps."

### Architecture

```
Cron (every 30 minutes)
  → WeatherService.getConditions(location)       [deterministic — API call]
  → WeatherDisruptionDetector.evaluate()          [deterministic — FAA rules]
    → For each affected reservation:
      → FSP Find-a-Time for alternative slots     [deterministic]
      → AI: prioritize which flights to rescue    [AI value-add #3]
      → Reschedule workflow (reuse existing)      [deterministic]
      → AI rationale (already in reschedule)      [AI — already built]
```

### Tasks

#### Task 2.1: Weather Service Interface + Mock
**File:** `src/lib/weather/types.ts` + `src/lib/weather/mock-provider.ts`

- Interface: `IWeatherService`
  - `getConditions(icaoCode: string): Promise<WeatherCondition>`
  - `getForecast(icaoCode: string, hoursAhead: number): Promise<WeatherForecast[]>`
- `WeatherCondition`: `{ ceiling: number, visibility: number, windSpeed: number, windGust: number, flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR', raw: string }`
- Mock provider returns configurable conditions (default VFR, can set specific locations to IFR for testing)
- Real provider (future): fetch from Aviation Weather API (aviationweather.gov) — free, no API key needed

#### Task 2.2: WeatherDisruptionDetector
**File:** `src/lib/engine/detection/weather-detector.ts`

- For a given location + time window:
  1. Fetch weather conditions/forecast
  2. Apply VFR minimums: ceiling >= 1000ft AGL, visibility >= 3 SM (configurable per operator for stricter minimums)
  3. Find all reservations in the affected time window via `getSchedule()`
  4. Filter to non-simulator flights only
- Return: `AffectedFlight[]` with: `reservationId`, `studentId`, `startTime`, `reason` (e.g., "IFR conditions: ceiling 800ft, visibility 2SM")
- Deterministic — no AI needed for weather rule evaluation

#### Task 2.3: AI Flight Prioritizer (AI Value-Add #3)
**File:** `src/lib/ai/flight-prioritizer.ts`

- Input: list of affected flights + student context for each (days since last flight, checkride date, training stage)
- Uses OpenAI to rank which flights are most important to rescue/reschedule
- Reasoning: "Dave's checkride is in 3 days and he hasn't flown in a week — high priority. Jamie's next lesson is routine — lower priority."
- Output: prioritized list with urgency scores + reasoning
- Fallback: sort by days-since-last-flight descending (most inactive = highest priority)

#### Task 2.4: Weather Disruption Workflow
**File:** `src/lib/engine/workflows/weather-disruption.ts`

- Register as `"weather_disruption"` in workflow registry
- Input: `AffectedFlight` + weather conditions
- Steps:
  1. Use AI prioritizer to rank affected flights (Task 2.3)
  2. For top N flights (configurable): call FSP `findAvailableSlots()` for same-day or next-day alternatives
  3. Build reschedule proposal with weather-specific rationale
- Rationale includes: weather conditions, when VFR is expected to return (from forecast), why this slot was chosen
- Reuses existing `ProposalBuilder` and `ReservationExecutor`

#### Task 2.5: Inngest Cron Function
**File:** `src/inngest/functions/check-weather.ts`

- Cron: `*/30 * * * *` (every 30 minutes)
- Fan-out per operator → per location
- For each location: fetch weather → if below minimums → detect affected flights → create triggers
- Add `"weather_disruption"` event type to events

#### Task 2.6: Operator Settings — Weather
- Add `weatherMinCeiling: number` (default 1000) and `weatherMinVisibility: number` (default 3) to operator settings
- Add UI toggle: `enabledWorkflows.weather_disruption: boolean`
- Add weather minimums config to Settings page

#### Task 2.7: Mock Data for Weather
- Mock weather provider defaults to VFR for all locations
- Add a test mode toggle or specific location that returns IFR conditions
- Ensure there are mock reservations in the affected time window

#### Task 2.8: UI — Weather Proposals in Queue
- Add `"weather_disruption"` to `WorkflowBadge` (weather icon, orange/amber color)
- Weather rationale shows conditions + forecast
- Activity feed shows `"weather_disruption_detected"` events

---

## AI Value-Add Summary

| # | Feature | Where Used | What It Does | Fallback |
|---|---------|-----------|-------------|----------|
| 1 | **AI Slot Ranker** | Inactivity outreach (and adoptable by all workflows) | Ranks candidate slots by student's historical preferences, instructor continuity, and urgency | Deterministic sort: instructor continuity + soonest |
| 2 | **AI Outreach Message Generator** | Inactivity outreach notifications | Generates warm, personalized email/SMS with student-specific context | Standard template from `templates.ts` |
| 3 | **AI Flight Prioritizer** | Weather disruptions | Ranks affected flights by urgency (checkride proximity, training gaps, student needs) | Sort by days-since-last-flight descending |

All three use the same OpenAI integration pattern as the existing auto-approver:
- `gpt-4o` via the OpenAI SDK
- Structured output (JSON schema) for deterministic parsing
- Graceful fallback to deterministic logic on failure/timeout
- Cost: ~$0.01-0.03 per call (small context windows)

---

## Implementation Order

| Phase | Tasks | Dependencies | Effort |
|-------|-------|-------------|--------|
| **A** | 1.1, 1.7, 1.8 | None | Small — detector + mock data + UI badge |
| **B** | 1.2, 1.3, 1.4 | Phase A | Medium — workflow + cron + settings |
| **C** | 1.5, 1.6 | Phase B | Medium — AI slot ranker + message generator |
| **D** | 2.1, 2.7 | None (parallel with A-C) | Small — weather service interface + mock |
| **E** | 2.2, 2.5, 2.6 | Phase D | Medium — detector + cron + settings |
| **F** | 2.3, 2.4, 2.8 | Phase E | Medium — AI prioritizer + workflow + UI |

**Total: ~6 agents dispatched across 3-4 rounds of parallel work.**

---

## Swap to Real FSP Data

When credentials arrive, the only changes needed:
- **Inactivity**: No changes — same `IFspClient` interface, real data flows through
- **Weather**: Replace `MockWeatherProvider` with `AvwtWeatherProvider` (Aviation Weather API) — one file swap
- All AI features work identically with real data
