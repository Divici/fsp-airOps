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

### Server-Side View Mappers (not client-side)

- **Chosen:** API routes call mapper functions that resolve DB IDs to human-readable names via FSP client, then return "View" types to the browser.
- **Alternatives:** Send raw IDs to the client and resolve names there, or denormalize names into the DB.
- **Why:** The FSP client (which knows instructor names, aircraft registrations, location names) is a server-only dependency. The browser cannot call FSP directly. Denormalizing into the DB would create stale-name bugs when FSP data changes.
- **Tradeoff:** Every proposal list request makes 4 parallel FSP calls (locations, users, aircraft, activity types) to build lookup maps. Could add caching later.
- **Analogy:** Like a waiter who translates the kitchen's internal ticket codes into dish names before bringing the menu to the table.

### Inline Execution on Approval (not queued)

- **Chosen:** When a dispatcher clicks "Approve," the API route calls `ReservationExecutor.executeProposal()` synchronously in the same HTTP request.
- **Alternatives:** Queue the execution as a background job (Inngest) and poll for completion.
- **Why:** Keeps UX simple. The button shows a loading spinner, and when the request completes, the dispatcher sees "Approved" or "Failed" immediately. No polling, no "pending execution" intermediate state.
- **Tradeoff:** If FSP is slow, the approve request takes longer. Acceptable for MVP; could move to async later.

### "Approved" Label Replaces "Executed" in UI

- **Chosen:** Dispatchers see "Approved" (green) after successful execution, not "Executed."
- **Why:** Dispatchers think in terms of their decision ("I approved it"), not the system's internal mechanics ("a reservation was created in FSP"). "Failed" is still shown separately for visibility.
- **Tradeoff:** Internal status still tracks `executed` vs `approved` in the DB for debugging.

### Tool-Calling Agent for Auto-Approval (not simple scorer)

- **Chosen:** OpenAI gpt-4o as a tool-calling agent with 6 scheduling tools.
- **Alternatives:** Simple weighted scorer (sum of heuristic signals), ReAct loop (agent reasons and acts in a loop with free-form tool use).
- **Why:** A simple scorer can't handle nuanced cases (e.g., "this student failed their last checkride, so scheduling them with a different instructor might be better"). Tool-calling lets the agent gather exactly the information it needs, like a human dispatcher would. ReAct was rejected because it's harder to constrain and more expensive per evaluation.
- **Tradeoff:** Requires OpenAI API key (~$0.01-0.03 per evaluation). Adds latency (2-5 seconds per evaluation). Deterministic fallback mitigates outage risk.
- **Analogy:** A simple scorer is like a checklist ("slot available? yes. same instructor? yes. score: 8/10"). A tool-calling agent is like a dispatcher who can pull up any record they need before making a judgment call.

### Async Auto-Approval via Inngest (not synchronous)

- **Chosen:** Auto-approval runs asynchronously via Inngest after proposal creation.
- **Alternatives:** Synchronous evaluation during proposal creation (block until agent finishes), polling from the client.
- **Why:** Lower perceived latency. The proposal appears in the UI as "pending" immediately. The agent evaluates in the background and transitions the proposal to "approved" if confident. If we blocked on the agent, proposal creation would take 3-8 seconds instead of <1 second.
- **Tradeoff:** There's a brief window where the proposal shows "pending" even though it will be auto-approved seconds later. The dispatcher might manually approve it before the agent finishes (harmless -- the agent checks status before acting).

### Await Query Invalidation in Mutations

- **Chosen:** React Query mutations `await queryClient.invalidateQueries()` before resolving, so the button loading state persists until fresh data arrives.
- **Alternatives:** Fire-and-forget invalidation (stale UI flickers briefly).
- **Why:** Prevents the 200ms window where the UI shows stale data (e.g., proposal still showing "Pending" after approval).

### Discovery Prospect Lifecycle (automatic status progression)

- **Chosen:** Prospect status advances automatically: `new` -> `processing` -> `proposed` (on trigger dispatch) -> `approved` -> `booked` (on proposal approval + execution success).
- **Why:** The dispatcher should not have to manually update prospect status. The system knows when a proposal was generated and when it was approved.
- **Tradeoff:** If execution fails, the prospect stays at "approved" (not "booked"), which requires manual follow-up.

---

## How Each Piece Works

### End-to-End Data Flow

The app is fully wired from UI to database and back. Here is the path a user action takes:

1. **UI component** calls a React Query hook (e.g., `useProposals()`).
2. The hook calls **`apiFetch<T>()`** (`src/lib/api/client.ts`), a typed fetch wrapper that hits a Next.js API route.
3. The **API route** (`src/app/api/...`) extracts the tenant from the request, queries the DB via Drizzle, and calls a **view mapper** to resolve IDs to names.
4. The mapper calls the **FSP client** to look up resource names (instructors, aircraft, locations).
5. The API route returns a **View type** (e.g., `ProposalView`) as JSON.
6. React Query caches the response and the UI renders.

For mutations (approve, create prospect), the flow adds: API route validates input -> updates DB -> executes side effects (e.g., ReservationExecutor) -> returns result -> mutation hook awaits `invalidateQueries()` -> UI refreshes.

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

### API Fetch Client (`src/lib/api/client.ts`)

- **What:** A typed fetch wrapper for calling the app's own Next.js API routes from React Query hooks.
- **How:** `apiFetch<T>(path, init)` calls `fetch()`, checks `res.ok`, and returns typed JSON. On error, throws `ApiError` with status code and message. In mock mode, the middleware auto-injects tenant headers so no auth setup is needed client-side.
- **Example:** `apiFetch<ProposalView[]>('/api/proposals')` returns a typed array of proposal views.

### View Mappers (`src/lib/api/mappers/`)

- **What:** Server-side functions that transform DB rows (which store numeric/string IDs) into View types (which have human-readable names).
- **How:** `mapProposals()` calls `buildLookups()` which makes 4 parallel FSP client calls to fetch all locations, users, aircraft, and activity types. It builds in-memory Maps for O(1) lookups. Then each DB row is mapped to a View object by replacing IDs with names.
- **Key pattern:** The lookups are built once per request, not per row. So mapping 50 proposals still only makes 4 FSP calls.
- **Example:** DB row has `{ studentId: "usr_123", locationId: 5 }` -> mapper resolves to `{ studentName: "John Smith", locationName: "KPAO - Palo Alto" }`.

### Auto-Approver (`src/lib/engine/auto-approver/`)

- **What:** A tool-calling AI agent that evaluates proposals and auto-approves them when confidence is high enough.
- **How:** When a proposal is generated, if the operator has auto-approval enabled, an Inngest function fires asynchronously. The agent (OpenAI gpt-4o) receives the proposal context and has access to 6 scheduling tools it can call to gather information (check availability, verify instructor qualifications, look up student history, etc.). It reasons through the proposal step by step, calls tools as needed, and returns a confidence score. If the score exceeds the operator's configured threshold, the proposal is auto-approved. The proposal appears as "pending" in the UI immediately, then transitions to "approved" in the background once the agent finishes.
- **Deterministic fallback:** If OpenAI is unavailable (API error, timeout, missing key), a rule-based scorer evaluates the proposal using the same criteria but without natural language reasoning. This ensures auto-approval never silently stops working.
- **Per-operator config:** Each operator can toggle auto-approval on/off and set their own confidence threshold (e.g., 0.85 means only auto-approve when the agent is 85%+ confident).
- **Example:** Proposal for rescheduling Student A to Tuesday 10am -> agent calls `checkAvailability` (slot is open), `getInstructorQualifications` (same instructor, qualified), `getStudentHistory` (student prefers mornings) -> confidence 0.92 -> exceeds threshold 0.85 -> auto-approved.
- **Analogy:** Like a senior dispatcher reviewing proposals in the background. They have access to all the same information a human would check, and they only approve when they're confident enough. If they're unsure, the proposal stays in the queue for a human.

### Trigger Service (`src/lib/engine/trigger-service.ts`)

- **What:** Creates, deduplicates, and dispatches scheduling triggers to the orchestrator.
- **How:** `createAndDispatch(params)` first checks for duplicate triggers within a dedup window (prevents double-processing). If unique, it inserts a trigger record, then calls `orchestrator.execute()` to run the corresponding workflow. Updates the trigger status based on the result.
- **Used by:** Discovery flight flow (prospect creation auto-dispatches a trigger), cancellation detection, lesson completion webhooks.
- **Example:** New prospect created -> `triggerService.createAndDispatch({ type: "discovery_flight", sourceEntityId: prospectId })` -> orchestrator runs discovery-flight workflow -> proposal is generated -> prospect status advances to "proposed."

### Operator Settings (`src/config/defaults.ts`)

- Configurable per operator. Defaults: 7-day search window, top 5 alternatives, prefer same instructor (weight 0.8), no same-aircraft preference (weight 0.3), daylight-only flights, all workflows enabled, email on / SMS off.
- These settings drive every workflow's behavior -- they control how aggressively the system searches, how many options to present, and what to prioritize.

---

## Things That Don't Work Well

- **FSP real client is completely stubbed** -- all 18 methods return mock data. Waiting on FSP dev credentials. Real-world edge cases (rate limits, stale data, auth token refresh, error formats) are completely unknown.
- **Race condition between validate and create** -- FSP uses a two-step API: validate reservation, then create reservation. Another user could book the same slot between these two calls. Inherent to FSP's API design; no solution without FSP-side locking.
- **Public FSP developer API is read-only** -- write operations (creating reservations) require an internal access tier that hasn't been confirmed. The entire execution pipeline may need rework if the write API differs from documentation.
- **Communication providers are stubs** -- email and SMS providers log to console instead of sending. Need actual integrations (SendGrid, Twilio, etc.).
- **Auth is mock-only** -- middleware auto-injects a tenant context. No real authentication flow exists yet.
- **In-memory metrics** -- MetricsCollector stores everything in memory. Restarting the server loses all metrics. Need to export to a real backend (Prometheus, Datadog, etc.) for production.
- **Auto-approver cost** -- each evaluation costs ~$0.01-0.03 in OpenAI API fees. At scale (1,300 operators, multiple proposals/day), this could add up. Deterministic fallback exists but provides lower-quality evaluations.
- **Waitlist ranking quality depends on signal quality** -- if FSP data about "time since last flight" is inaccurate or missing, ranking degrades. Will need iteration with real data.
- **Timezone handling is tricky** -- FSP reservation create uses local time, AutoSchedule returns UTC, availability uses UTC with dayOfWeek. The `TimezoneResolver` defaults to UTC when no mapping is provided. Getting this wrong creates off-by-hours reservation bugs.
- **No FSP webhooks confirmed** -- if FSP doesn't support real-time event streams, the cancellation detector relies on polling (snapshot comparison), which introduces latency.
- **Single-threaded execution** -- ReservationExecutor processes actions sequentially within a proposal. For proposals with many actions, this could be slow.
- **Rate limiter is in-memory** -- the 55 req/60s rate limiter for FSP API calls uses an in-memory token bucket. In a multi-instance deployment, each instance tracks its own limits independently, so aggregate requests could exceed the real FSP rate limit.
- **View mapper makes 4 FSP calls per request** -- every proposal list request fetches all locations, users, aircraft, and activity types to build lookup maps. No caching layer yet. Could be slow with a real FSP API.

---

## Key Metrics & Results

### Test Coverage

- **551 tests** across 47 test files, all passing.
- **48 tasks** across 6 phases, all complete, plus pre-credentials hardening work.
- Coverage spans: orchestrator, all 4 workflows, waitlist ranking, cancellation detection, reservation execution, proposal lifecycle, FSP client mock, observability, error handling, retry logic, feature flags, communication service, templates, auto-approver, and rate limiter.

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
