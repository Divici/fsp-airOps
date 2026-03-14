# Study Guide: FSP Agentic Scheduler

## What We're Building

An AI-assisted scheduling optimization console for flight schools that use Flight Schedule Pro (FSP). Think of it as a smart assistant for flight school dispatchers -- it watches the schedule, spots opportunities (cancelled slots, students needing their next lesson, discovery flight requests, waitlist openings), and suggests schedule changes. Humans approve everything before it happens.

The key insight: this is NOT a chatbot or autonomous scheduler. It's an operational tool that makes human schedulers faster by doing the analysis work and presenting ready-to-approve proposals. Like a sous chef who preps all the ingredients and says "this looks ready" -- but the head chef still decides when to fire.

**Who it's for:** Flight school schedulers/dispatchers, with secondary users being instructors, students, and prospects requesting discovery flights.

**Scale:** ~1,300 flight school operators, ~20,000 daily flights across the FSP platform.

**MVP scope:** Suggest-and-approve only. No autonomous schedule mutations. Every reservation change requires human approval.

---

## How It Works (High Level)

1. A **trigger** fires -- a flight gets cancelled, a lesson is completed, a prospect requests a discovery flight, or a periodic scan finds a waitlist opening.
2. The **orchestration engine** maps the trigger to one of four workflow types and loads the operator's tenant-specific settings (ranking weights, search window, preferences).
3. The workflow fetches relevant data from **FSP APIs** -- availability, aircraft, instructors, schedule state.
4. **Deterministic scheduling logic** uses FSP's scheduling tools (Find-a-Time, AutoSchedule solver) to generate valid slot options that respect hard constraints (daylight, availability, aircraft/instructor compatibility).
5. A **slot ranker** scores and ranks the options using configurable operator weights (prefer same instructor? same aircraft? time-of-day similarity?).
6. The top-N options become a **proposal** that lands in the **approval queue**.
7. A dispatcher reviews and approves or declines.
8. On approval, the **ReservationExecutor** runs a validate-then-create pipeline: freshness check, FSP validation, FSP create, audit log.
9. A **notification** goes out via email/SMS (communication service with pluggable providers).
10. Everything is recorded in an **immutable audit trail** with correlation IDs for tracing.

---

## Key Decisions & Why

### Hybrid AI + Deterministic (not pure AI, not pure rules)

- **Chosen:** AI for orchestration/explainability, deterministic logic for scheduling correctness.
- **Alternatives:** Pure LLM scheduling (too risky -- scheduling has hard constraints), Pure deterministic (works but misses the "AI product" value).
- **Why:** An LLM can't reliably check if an aircraft is available at 2pm on Tuesday -- but it's great at explaining WHY a particular slot is the best option. Like having a smart assistant who reads all the data but lets the calculator do the math.
- **Tradeoff:** More complex to build than either pure approach, but much safer and more credible for enterprise customers.

### Next.js Single App (not monorepo, not separate services)

- **Chosen:** One Next.js 15 app with organized `src/lib/` modules.
- **Alternatives:** pnpm workspace monorepo, separate frontend + API.
- **Why:** For MVP, the overhead of multiple packages isn't justified. Next.js handles both the UI and API routes. Think of it like building a house -- you don't need separate construction crews for each room when one team can do it all.
- **Tradeoff:** May need to extract a worker process later for background jobs.

### Drizzle ORM (not Prisma, not raw SQL)

- **Chosen:** Drizzle with PostgreSQL.
- **Alternatives:** Prisma (heavier runtime, more ecosystem), Kysely (query builder only).
- **Why:** Drizzle gives type-safe queries that look like SQL. Lighter than Prisma's runtime, and the schema-as-code approach fits well with TypeScript.
- **Tradeoff:** Smaller ecosystem than Prisma, fewer guides/tutorials available.

### Inngest for Background Jobs (not cron, not BullMQ)

- **Chosen:** Inngest -- event-driven step functions with fan-out, retries, and rate limiting.
- **Alternatives:** API routes + cron (doesn't scale to 1,300 operators), BullMQ + Redis (requires Redis infrastructure).
- **Why:** The system needs to fan out per-tenant scans. Inngest runs alongside Next.js with no Redis required. Think of it like a smart job queue that can run 1,300 parallel tasks without you managing the infrastructure.
- **Tradeoff:** Adds a dev dependency (`inngest-cli dev` during development).

### Shadcn/ui (not Ant Design, not raw Radix)

- **Chosen:** Shadcn/ui components (Tailwind-native, copies source into project).
- **Alternatives:** Radix primitives alone (too much styling work), Ant Design (fights Tailwind).
- **Why:** Full customization -- the component source lives in your project, not a node_module. Uses Radix underneath for accessibility.
- **Tradeoff:** You own and maintain the components, not a library.

### Mock-First FSP Integration

- **Chosen:** Typed `IFspClient` interface with `MockFspClient` implementation.
- **Why:** No FSP dev credentials yet. Building against interfaces means we can develop and test everything, then swap in real API calls by implementing the same interface.
- **Tradeoff:** Delays discovery of real API edge cases (rate limits, error responses, data quirks).

### FSP Credential Proxy for Auth

- **Chosen:** Users log in with FSP email/password. App calls FSP auth API to get a token.
- **Alternatives:** NextAuth (more setup than needed), API key per operator (no user-level identity).
- **Why:** Simplest approach -- no separate auth system to maintain.
- **Tradeoff:** Auth is coupled to FSP availability.

### date-fns-tz for Timezone Handling

- **Chosen:** date-fns-tz (lightweight, tree-shakeable).
- **Alternatives:** Luxon (larger bundle), dayjs (less mature timezone support).
- **Why:** FSP has a critical mismatch: reservation create uses local time (no timezone suffix), but AutoSchedule returns UTC. You need reliable UTC-to-local conversion. date-fns-tz handles this with `formatInTimeZone`.
- **Tradeoff:** Single-library dependency for all timezone logic.

### Vitest for Testing (not Jest)

- **Chosen:** Vitest with jsdom for component tests.
- **Why:** Native ESM support, fast, works seamlessly with the Vite-based toolchain. Same API as Jest so the learning curve is zero.

---

## How Each Piece Works

### Orchestrator (`src/lib/engine/orchestrator.ts`)

- **What:** The central entry point for all workflow execution.
- **How:** Takes a `SchedulingTrigger`, maps it to a workflow type via `WorkflowRegistry`, loads operator settings, builds a context, calls `handler.execute()`, and persists the resulting proposal. Everything is wrapped in try/catch with audit logging for both success and failure paths.
- **Example:** Trigger `{ type: "cancellation", operatorId: 42 }` -> maps to "reschedule" workflow -> loads operator 42's settings -> executes `RescheduleWorkflowHandler` -> stores proposal -> returns `{ proposalId: "abc", success: true }`.

### Workflow Registry (`src/lib/engine/workflow-registry.ts`)

- **What:** A lookup table that maps workflow type strings to handler instances.
- **How:** `createOrchestrator()` in `engine/index.ts` registers all four handlers at startup. The registry's `getHandler()` returns the right handler for a given workflow type. `triggerToWorkflow()` maps trigger types (like "cancellation") to workflow types (like "reschedule").
- **Analogy:** Like a phone switchboard -- "cancellation" call comes in, gets routed to the "reschedule" handler.

### Four Workflows (`src/lib/engine/workflows/`)

All four follow the same pattern: receive context, fetch data from FSP, run deterministic logic, rank results, return proposed actions.

**Reschedule** (`reschedule.ts`):
- Trigger: A reservation gets cancelled.
- Does: Finds alternative slots for the affected student using Find-a-Time. Ranks by instructor continuity, aircraft preference, and time-of-day similarity to the original.
- Example: Student John's Monday 9am got cancelled -> finds Tuesday 10am, Wednesday 2pm, Thursday 9am -> ranks them -> proposes top 5.

**Next Lesson** (`next-lesson.ts`):
- Trigger: A student completes a training lesson.
- Does: Resolves the next lesson in the enrollment syllabus via `NextLessonResolver`, then finds available slots for that specific lesson type. Prioritizes the same instructor for continuity.
- Example: Student completes "Lesson 5: Solo Prep" -> resolver finds "Lesson 6: First Solo" requires 2.0 hours -> finds slots -> proposes options.

**Discovery Flight** (`discovery-flight.ts`):
- Trigger: A prospect submits a discovery flight request.
- Does: Finds available 60-minute slots, filters for daylight-only (uses civil twilight data from FSP), respects prospect's preferred time windows (morning/afternoon/evening).
- Example: Prospect wants Saturday morning -> finds all slots -> filters out pre-sunrise/post-sunset -> filters for morning hours -> proposes top 5.

**Waitlist** (`waitlist.ts`):
- Trigger: A schedule opening is detected.
- Does: Finds eligible candidates via `CandidateFinder`, ranks them with `WaitlistRanker` using weighted signals, then finds a matching slot for each top candidate.
- Example: Tuesday 2pm opens up -> finds 8 eligible students -> ranks by time-since-last-flight, flight hours, instructor continuity -> proposes top 5 with matched slots.

### Waitlist Ranking (`src/lib/engine/waitlist/`)

- **What:** Ranks students competing for a schedule opening using configurable weighted signals.
- **How:** The `WaitlistRanker` normalizes each signal (min-max normalization across all candidates), multiplies by operator-configured weights, and sums for a final score. Ties are broken alphabetically for deterministic ordering.
- **Signals:** `timeSinceLastFlight` (higher = more urgent), `timeUntilNextFlight` (lower = more urgent), `totalHours` (experience level), `instructorContinuity` (0 or 1), `aircraftFamiliarity` (0 or 1).
- **Example:** Student A hasn't flown in 14 days (high urgency) with same instructor available (continuity=1) scores higher than Student B who flew 2 days ago (low urgency).
- **Analogy:** Like a weighted GPA calculation -- each signal is a "grade" and each weight is how many "credits" that class is worth.

### Slot Ranker (`src/lib/engine/scheduling/slot-ranker.ts`)

- **What:** Ranks available time slots for the reschedule, next-lesson, and discovery-flight workflows.
- **How:** Scores each slot based on same-instructor bonus, same-aircraft bonus, and time-of-day similarity to the original. Uses operator-configured weights.

### Cancellation Detector (`src/lib/engine/detection/cancellation-detector.ts`)

- **What:** Detects cancelled reservations by comparing schedule snapshots.
- **How:** Takes a "before" snapshot and fetches the current schedule from FSP. Compares the two using `compareSnapshots()` and returns any reservations that disappeared (= cancelled). Stateless -- the caller is responsible for storing the previous snapshot.
- **Example:** Previous snapshot has reservations [A, B, C, D]. Current FSP schedule has [A, C, D]. Detector returns B as cancelled.
- **Analogy:** Like doing a diff between two versions of a file -- anything in the old version but not the new one was "deleted."

### Reservation Executor (`src/lib/engine/execution/reservation-executor.ts`)

- **What:** The validate-then-create pipeline that runs when a dispatcher approves a proposal.
- **How:** For each proposed action: (1) freshness check -- is the slot still available? (2) build the FSP reservation payload with UTC-to-local-time conversion, (3) call `fspClient.validateReservation()`, (4) call `fspClient.createReservation()`, (5) record result + audit trail. If any step fails, the action is marked failed with the specific reason.
- **Why validate-then-create?** Time passes between proposal generation and approval. The slot might have been taken. Validating first avoids creating a conflicting reservation.
- **Critical detail:** FSP reservation create requires LOCAL TIME (no timezone suffix). The executor uses `formatInTimeZone()` from date-fns-tz to convert UTC to the location's timezone.

### Proposal Lifecycle (`src/lib/engine/proposal-lifecycle.ts`)

- **What:** A state machine that enforces valid status transitions for proposals.
- **States:** `draft` -> `pending` -> `approved`/`declined`/`expired` -> `executed`/`failed`. Failed can retry back to `pending`.
- **How:** `assertTransition(from, to)` throws if the transition is invalid. Used by the executor before creating reservations (only `approved` -> `executed` is valid).

### FSP Client (`src/lib/fsp-client/`)

- **What:** Typed TypeScript wrappers around all FSP API endpoints.
- **Interface:** `IFspClient` defines 18 methods across 7 categories: auth, resources, availability, schedule, scheduling tools, reservations, and training.
- **Mock:** `MockFspClient` is stateful and configurable. It supports scenarios (`default`, `no_available_slots`, `validation_fails`, `all_slots_taken`). It has mutable state for reservations (can add/remove) and realistic mock data for all resource types.
- **Example:** `fspClient.findATime(operatorId, { activityTypeId, startDate, endDate, duration })` returns `SlotOption[]` -- same interface whether mock or real.

### Observability (`src/lib/observability/`)

Three components, all with singleton instances exported from `index.ts`:

**Logger** (`logger.ts`):
- Structured JSON in production, pretty-printed in development.
- Automatically attaches correlation ID, operator ID, and workflow type from `AsyncLocalStorage`.
- Level filtering: debug/info/warn/error with configurable minimum.

**CorrelationContext** (`correlation.ts`):
- Uses Node.js `AsyncLocalStorage` to propagate correlation IDs through async operations without passing them explicitly.
- `CorrelationContext.run(data, fn)` wraps a function with correlation context. Every log line inside that function automatically gets the correlation ID.
- Can extract correlation ID from incoming HTTP requests (`x-correlation-id` header).
- **Analogy:** Like a thread-local variable in Java, but for async Node.js code.

**MetricsCollector** (`metrics.ts`):
- In-memory counters, timings, and gauges. No external dependency for MVP.
- Well-known metric names: `proposals_generated`, `proposals_approved`, `reservations_created`, `workflow_duration_ms`, `fsp_api_calls`, `fsp_api_errors`.
- Supports tags for dimensional metrics (e.g., `workflow_type=reschedule`).
- `getMetrics()` returns a full snapshot. Can be exported to a real metrics backend later.

### Error Handling (`src/lib/errors/`)

**Error Hierarchy** (`types.ts`):
- `AppError` base class with `code`, `statusCode`, `isOperational` fields.
- Subclasses: `FspApiError` (502), `WorkflowError` (500), `ValidationError` (400), `TenantError` (401), `ProposalError` (400).
- `isOperational = true` means expected/handled error (not a bug). `false` means unexpected programming error.

**ErrorHandler** (`error-handler.ts`):
- Normalizes any thrown value to an `AppError`.
- Classifies retryable errors: 5xx, rate limits, timeouts, network errors.
- `toApiResponse()` returns safe error responses (no internal details leaked for non-operational errors).

**Retry** (`retry.ts`):
- `withRetry(fn, options)` -- exponential backoff with jitter.
- Formula: `min(baseDelay * 2^attempt + random_jitter, maxDelay)`.
- Jitter prevents thundering herd (all retries hitting at the same moment).
- Configurable: max retries (default 3), base delay (default 1s), max delay (default 30s), retryOn predicate.

### Feature Flags (`src/lib/feature-flags/`)

- **What:** Per-operator feature flag resolution.
- **How:** `FeatureFlagService.getFlags(operatorId)` loads the operator's settings from the database, maps `enabledWorkflows` and `communicationPreferences` columns to boolean flags, and merges with defaults. If no operator settings exist, returns all defaults.
- **Flags:** `enableReschedule`, `enableDiscoveryFlight`, `enableNextLesson`, `enableWaitlist`, `enableEmailNotifications`, `enableSmsNotifications`.

### Communication Service (`src/lib/comms/`)

- **What:** Sends notifications (email/SMS) with pluggable providers and full history tracking.
- **How:** `CommunicationService` has a provider registry. On `send()`: inserts a "pending" record in DB, calls the provider, updates the record to "sent" or "failed". Full history is queryable per operator.
- **Templates** (`templates.ts`): Mustache-style `{{variable}}` interpolation for 4 templates: `proposal_ready`, `proposal_approved`, `reservation_created`, `discovery_flight_confirmation`.
- **Providers:** `email-provider.ts` and `sms-provider.ts` define the pluggable interfaces.

### Operator Settings (`src/config/defaults.ts`)

- Configurable per operator. Defaults: 7-day search window, top 5 alternatives, prefer same instructor (weight 0.8), no same-aircraft preference (weight 0.3), daylight-only flights, all workflows enabled, email on / SMS off.
- These settings drive every workflow's behavior -- they control how aggressively the system searches, how many options to present, and what to prioritize.

---

## Things That Don't Work Well

- **No real FSP integration yet** -- everything runs against mocks, so real-world edge cases (rate limits, stale data, timezone bugs, auth token refresh) are unknown.
- **In-memory metrics** -- MetricsCollector stores everything in memory. Restarting the server loses all metrics. Need to export to a real backend (Prometheus, Datadog, etc.) for production.
- **Waitlist ranking quality depends on signal quality** -- if FSP data about "time since last flight" is inaccurate or missing, ranking degrades. Will need iteration with real data.
- **Timezone handling is tricky** -- FSP reservation create uses local time, AutoSchedule returns UTC, availability uses UTC with dayOfWeek. The `TimezoneResolver` defaults to UTC when no mapping is provided. Getting this wrong creates off-by-hours reservation bugs.
- **No FSP webhooks confirmed** -- if FSP doesn't support real-time event streams, the cancellation detector relies on polling (snapshot comparison), which introduces latency.
- **Single-threaded execution** -- ReservationExecutor processes actions sequentially within a proposal. For proposals with many actions, this could be slow.
- **No rate limiting on FSP calls** -- the mock doesn't enforce rate limits, so we don't know how the system behaves under FSP's actual rate limits.
- **Communication providers are interfaces only** -- no real email/SMS sending is implemented. The providers need actual integrations (SendGrid, Twilio, etc.).
- **Proposal expiration is passive** -- proposals have an `expiresAt` field but no background job actively expires them. They get checked on access.

---

## Key Metrics & Results

### Test Coverage

- **518 tests** across 43 test files, all passing.
- **48 tasks** across 6 phases, all complete.
- Coverage spans: orchestrator, all 4 workflows, waitlist ranking, cancellation detection, reservation execution, proposal lifecycle, FSP client mock, observability, error handling, retry logic, feature flags, communication service, and templates.

### Architecture Numbers

- 4 workflow types (reschedule, next-lesson, discovery-flight, waitlist)
- 18 FSP client interface methods across 7 API categories
- 6 error types in a structured hierarchy
- 6 feature flags (4 workflow toggles + 2 notification toggles)
- 6 well-known metric names
- 4 communication templates
- 7 proposal lifecycle states with enforced transitions

### Target Metrics (from PRD -- not yet measured)

- Schedule change detection: within minutes of trigger
- Recommendation generation: < 30 seconds
- Suggestion acceptance rate (measures proposal quality)
- Time-to-fill openings (measures operational impact)
- Manual edits after suggestion (measures how "approval-ready" proposals are)

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.9 |
| Database | PostgreSQL + Drizzle ORM |
| Background Jobs | Inngest |
| UI Components | Shadcn/ui + Tailwind CSS 4 |
| Client State | TanStack Query |
| AI | OpenAI (GPT-4o) |
| Timezones | date-fns-tz |
| Validation | Zod |
| Testing | Vitest + Testing Library |
| Package Manager | pnpm |
