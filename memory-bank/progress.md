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

## In Progress
Nothing active — MVP is feature-complete.

## Not Started (Post-MVP)
- [ ] Real FSP API integration (awaiting credentials)
- [ ] Real auth (currently mock mode, auto-injects operatorId: 1)
- [ ] Communication provider wiring (Twilio/SendGrid)
- [ ] Durable snapshot persistence (currently in-memory Map)
- [ ] Deployment pipeline (target Azure)
- [ ] Multi-tenant onboarding flow
- [ ] Performance testing with real FSP data volumes

## Known Issues
- No FSP dev credentials — building mock-first. Request sent to FSP technical contact.
- FSP public developer API is READ-ONLY; write endpoints require internal API access.
- Snapshot persistence is in-memory (lost on restart).
- Auth is mock-only (middleware auto-injects operatorId: 1).
- Communication providers are interface stubs (no Twilio/SendGrid).
- FSP real client: all 18 methods are stubs awaiting credentials.

## Test Count
518 tests across 43 test files
