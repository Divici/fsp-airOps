# Progress: FSP Agentic Scheduler

## Completed
- [x] Project bootstrapping
- [x] Development workflow setup (.claude/, skills, hooks)
- [x] Memory bank initialized
- [x] Decision log initialized
- [x] Stack decisions locked (pnpm, Next.js, Drizzle, PostgreSQL, OpenAI, Vitest)

### Phase 1: Foundation
- [x] Next.js project scaffold (pnpm, dependencies, config)
- [x] Docker Compose for PostgreSQL
- [x] Drizzle schema for app-owned entities
- [x] Typed FSP API client interfaces + mock implementations
- [x] Tenant isolation (operatorId on every record/query)
- [x] Audit/event framework
- [x] Operator settings persistence
- [x] App shell with dashboard layout

### Phase 2: Core Engine + Reschedule
- [x] Orchestration engine + workflow registry
- [x] Proposal lifecycle (create, approve, decline, expire)
- [x] Trigger service with deduplication
- [x] Find-a-Time adapter for slot generation
- [x] Slot ranker (scoring + sorting)
- [x] Reschedule workflow handler
- [x] AI rationale generation (OpenAI with deterministic fallback)
- [x] Approval API (approve/decline endpoints)
- [x] Reservation executor (validate-then-create pattern)
- [x] Cancellation detection via Inngest cron
- [x] E2E test for reschedule workflow

### Phase 3: Discovery Flight Booking
- [x] Prospect request model + API
- [x] Discovery flight intake form at /book/[id]
- [x] Discovery flight workflow with daylight filtering
- [x] Discovery flight management UI
- [x] Discovery flight E2E test

### Phase 4: Schedule Next Lesson
- [x] Enrollment resolver + training context
- [x] Next-lesson workflow handler
- [x] Lesson completion detection trigger
- [x] Training context display in UI
- [x] Next lesson E2E test

### Phase 5: Waitlist Automation
- [x] Candidate finder service
- [x] Eligibility checker
- [x] Weighted ranking with configurable weights
- [x] Waitlist workflow handler
- [x] Opening detection trigger
- [x] Operator settings UI for waitlist weights
- [x] Batch approval/decline API
- [x] Waitlist E2E test

### Phase 6: Hardening
- [x] Audit feed UI
- [x] Communication service (email/SMS interface stubs)
- [x] Feature flags for phased rollout
- [x] Observability (structured logger, correlation context, metrics collector)
- [x] Proposal expiration cron job
- [x] Dashboard metrics endpoint + UI cards

### UI Wiring (post-Phase 6)
- [x] Wired all 7 React Query hooks to real API endpoints (removed ~1000 lines of mock data)
- [x] Server-side mappers: proposal, prospect, audit (DB rows → View types with FSP name resolution)
- [x] New API endpoints: GET/PATCH /api/settings, POST /api/settings/reset, GET /api/audit, GET /api/dashboard/metrics, POST /api/proposals/batch/approve, POST /api/proposals/batch/decline
- [x] Post-approval execution wiring (approve → ReservationExecutor)
- [x] Discovery flow fix: prospect POST dispatches trigger, advances status, links proposal
- [x] Cancellation trigger context field mapping fix
- [x] Dashboard cards clickable with filtered proposal views
- [x] UI label fixes ("Executed" → "Approved"), filter labels, newest-first sort
- [x] Mutation loading state: await invalidateQueries

### Pre-Credentials Hardening
- [x] Auto-approver feature (tool-calling AI agent with OpenAI gpt-4o, 6 scheduling tools, async via Inngest, deterministic fallback, per-operator config)
- [x] Seed script (`pnpm db:seed`) for demo data
- [x] RealFspClient HTTP methods implemented (GET/POST/PUT/DELETE with auth headers)
- [x] Rate limiter for FSP API calls (55 req/60s)
- [x] Snapshot persistence moved to database (was in-memory Map)
- [x] Empty/error states added to all UI views

## In Progress
Nothing active — all pre-credentials work is complete.

## Not Started (Post-Credentials)
- [ ] FSP credentials acquisition (subscription key, write API access, test operator)
- [ ] Real FSP API testing (validate RealFspClient against live endpoints)
- [ ] Communication provider wiring (Twilio/SendGrid)
- [ ] Real auth (currently mock mode, auto-injects operatorId: 1)
- [ ] Deployment pipeline (target Azure)
- [ ] Multi-tenant onboarding flow
- [ ] Performance testing with real FSP data volumes

## Known Issues
- No FSP dev credentials — building mock-first. Waiting on FSP tech contact for: subscription key, write API access, test operator.
- FSP public developer API is READ-ONLY; write endpoints require internal API access.
- Auth is mock-only (middleware auto-injects operatorId: 1).
- Communication providers are interface stubs (no Twilio/SendGrid).
- In-memory metrics (lost on restart, needs export to real backend for production).

## Test Count
551 tests across 47 test files
