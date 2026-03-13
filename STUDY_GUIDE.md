# Study Guide: FSP Agentic Scheduler

## What We're Building

An AI-assisted scheduling optimization console for flight schools that use Flight Schedule Pro (FSP). Think of it as a smart assistant for flight school dispatchers -- it watches the schedule, spots opportunities (cancelled slots, students needing their next lesson, discovery flight requests), and suggests schedule changes. Humans approve everything before it happens.

The key insight: this is NOT a chatbot or autonomous scheduler. It's an operational tool that makes human schedulers faster by doing the analysis work and presenting ready-to-approve proposals.

**Who it's for:** Flight school schedulers/dispatchers, with secondary users being instructors, students, and prospects requesting discovery flights.

**Scale:** ~1,300 flight school operators, ~20,000 daily flights across the FSP platform.

## How It Works (High Level)

1. A **trigger** fires -- a flight gets cancelled, a lesson is completed, a prospect requests a discovery flight, or a periodic scan finds an opening.
2. The **orchestration engine** identifies the workflow type and loads the operator's tenant-specific settings (ranking weights, preferences).
3. The system fetches relevant data from **FSP APIs** -- availability, aircraft, instructors, schedule state.
4. **Deterministic logic** uses FSP's scheduling tools (Find-a-Time, AutoSchedule solver) to generate valid slot options that respect hard constraints (daylight, availability, aircraft/instructor compatibility).
5. **AI (OpenAI)** assembles the options into an explainable proposal with rationale ("Student X hasn't flown in 12 days and has availability Tuesday afternoon; Instructor Y is free and has taught them before").
6. The proposal lands in the **approval queue** -- a dispatcher reviews and approves/declines.
7. On approval, the system **re-validates** the reservation with FSP (validate-then-create pattern), creates it, and sends a notification.
8. Everything is logged in an **immutable audit trail**.

## Key Decisions & Why

### Hybrid AI + Deterministic (not pure AI, not pure rules)

- **Chosen:** AI for orchestration/explainability, deterministic logic for scheduling correctness
- **Alternatives:** Pure LLM scheduling (too risky -- scheduling has hard constraints), Pure deterministic (works but misses the "AI product" value)
- **Why:** An LLM can't reliably check if an aircraft is available at 2pm on Tuesday -- but it's great at explaining WHY a particular slot is the best option. Like having a smart assistant who reads all the data but lets the calculator do the math.
- **Tradeoff:** More complex to build than either pure approach, but much safer and more credible for enterprise customers.

### Next.js Single App (not monorepo, not separate services)

- **Chosen:** One Next.js app with organized `src/lib/` modules
- **Alternatives:** pnpm workspace monorepo, separate frontend + API
- **Why:** For MVP, the overhead of multiple packages isn't justified. Next.js handles both the UI and API routes. Think of it like building a house -- you don't need separate construction crews for each room when one team can do it all.
- **Tradeoff:** May need to extract a worker process later for background jobs.

### Drizzle ORM (not Prisma, not raw SQL)

- **Chosen:** Drizzle with PostgreSQL
- **Alternatives:** Prisma (heavier runtime, more ecosystem), Kysely (query builder only)
- **Why:** Drizzle gives type-safe queries that look like SQL. Lighter than Prisma's runtime, and the schema-as-code approach fits well with TypeScript.
- **Tradeoff:** Smaller ecosystem than Prisma, fewer guides/tutorials available.

### Mock-First FSP Integration

- **Chosen:** Typed interfaces with mock implementations for development
- **Why:** No FSP dev credentials yet. Building against interfaces means we can develop and test everything, then swap in real API calls later.
- **Tradeoff:** Delays discovery of real API edge cases (rate limits, error responses, data quirks).

### OpenAI for AI Layer

- **Chosen:** OpenAI GPT-4o
- **Alternatives:** Claude API, both with abstraction layer
- **Why:** User preference. Function calling support is mature.
- **Tradeoff:** Vendor lock-in risk, but can add abstraction later.

## How Each Piece Works

### Orchestration Engine (`src/lib/engine/`)
- **What:** The brain that coordinates all four workflows through a unified pipeline.
- **How:** Takes a trigger (cancellation, lesson completion, etc.), resolves the tenant context, loads operator settings, fetches data from FSP, runs deterministic scheduling, then asks AI to assemble a proposal. One engine, not four separate pipelines.
- **Example:** Trigger: "Reservation #123 cancelled" -> Engine fetches student info + availability -> Calls Find-a-Time for alternative slots -> AI assembles proposal with rationale -> Proposal lands in approval queue.

### FSP Client (`src/lib/fsp-client/`)
- **What:** Typed TypeScript wrappers around all FSP API endpoints.
- **How:** Each FSP API section (reservations, availability, aircraft, etc.) gets a typed interface. A mock implementation returns realistic test data. A real implementation makes HTTP calls with auth headers.
- **Example:** `fspClient.findAvailableSlots({ activityType, dateRange, instructorId })` returns `TimeSlot[]` -- same interface whether mock or real.

### Database Layer (`src/lib/db/`)
- **What:** Stores app-owned data only (proposals, audit events, settings, prospect requests). FSP remains the source of truth for reservations.
- **How:** Drizzle schema defines tables, migrations handle schema changes. Every table has an `operatorId` column for tenant isolation.
- **Example:** `proposals` table with fields: id, operatorId, workflowType, triggerId, status, rationale, proposedActions (JSON), createdAt, expiresAt.

### Approval Queue (UI)
- **What:** The primary screen dispatchers use -- a list of pending proposals with bulk approve/decline.
- **How:** Fetches proposals filtered by operator, sorted by urgency. Each proposal shows the recommendation, rationale, and affected entities. Approve triggers validate-then-create reservation flow.
- **Example:** Dispatcher sees: "Reschedule John Smith - Lesson 5 | Tuesday 2pm with Instructor Jones in N12345 | Reason: cancelled Monday slot, student hasn't flown in 12 days" -> clicks Approve.

## Things That Don't Work Well

- **No real FSP integration yet** -- everything runs against mocks, so real-world edge cases (rate limits, stale data, timezone bugs) are unknown.
- **Background job model undecided** -- the engine can generate proposals on demand, but how triggers fire automatically (polling? webhooks? cron?) is TBD.
- **Waitlist ranking is hard** -- the quality of waitlist suggestions depends heavily on signal quality and operator-specific preferences. Will need iteration.
- **Timezone handling is tricky** -- FSP reservation create uses local time, AutoSchedule returns UTC, availability uses UTC times with dayOfWeek. Easy to get wrong.
- **No FSP webhooks confirmed** -- if FSP doesn't support real-time event streams, we're limited to polling, which introduces latency.

## Key Metrics & Results

No metrics yet -- project is in bootstrap phase.

**Target metrics (from PRD):**
- Schedule change detection: within minutes of trigger
- Recommendation generation: < 30 seconds
- Suggestion acceptance rate (measures proposal quality)
- Time-to-fill openings (measures operational impact)
- Manual edits after suggestion (measures how "approval-ready" proposals are)
