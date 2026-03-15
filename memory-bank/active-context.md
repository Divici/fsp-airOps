# Active Context: FSP Agentic Scheduler

## Current Phase
All pre-credentials work is complete. MVP is feature-complete, UI-wired, auto-approver built, and seed data available. Awaiting FSP dev credentials for real integration.

## Active Plan
See `memory-bank/plans/mvp-implementation-plan.md` and `.claude/plans/functional-tinkering-fairy.md`.

## Just Completed
- Phase 1: Foundation (10 tasks) — scaffold, DB schema, types, FSP mock, tenant, audit, config, app shell
- Phase 2: Core Engine + Reschedule (12 tasks) — orchestrator, proposals, triggers, reschedule workflow, AI rationale, approval API/UI, reservation executor, cancellation detection, E2E test
- Phase 3: Discovery Flight Booking — prospect model + API, intake form at /book/[id], discovery flight workflow with daylight filtering, discovery management UI
- Phase 4: Schedule Next Lesson — enrollment resolver, next-lesson workflow, lesson completion detection, training context display
- Phase 5: Waitlist Automation — candidate finder, eligibility checker, weighted ranking, waitlist workflow, opening detection, operator settings UI, batch approval
- Phase 6: Hardening — audit feed UI, communication service (provider stubs), feature flags, observability (logger, correlation context, metrics collector), proposal expiration cron, dashboard metrics

### UI Wiring Session
- Wired ALL 7 mock React Query hooks to real API endpoints (removed ~1000 lines of mock data)
- Created server-side mappers (proposal, prospect, audit) to transform DB rows → View types with FSP name resolution
- Created new API endpoints: GET/PATCH /api/settings, POST /api/settings/reset, GET /api/audit, GET /api/dashboard/metrics, POST /api/proposals/batch/approve, POST /api/proposals/batch/decline
- Wired post-approval execution: approve endpoint now calls ReservationExecutor
- Fixed discovery flow: prospect POST now dispatches trigger via TriggerService, advances prospect status, and links proposal
- Fixed cancellation trigger context field mapping (cancelledStudentId → studentId)
- Dashboard cards are clickable, link to filtered proposal views
- Renamed "Executed" → "Approved" in UI (dispatchers think in approvals, not executions)
- Filter labels added to proposals page
- Proposals sort newest-first
- await invalidateQueries so mutations hold loading state until data refreshes

### Pre-Credentials Hardening (latest)
- **Auto-approver feature**: Tool-calling AI agent (OpenAI gpt-4o) with 6 scheduling tools, async via Inngest, deterministic fallback, per-operator config (enabled toggle + confidence threshold)
- **Seed script**: `pnpm db:seed` populates demo data for local development
- **RealFspClient**: HTTP methods implemented (GET/POST/PUT/DELETE with auth headers), awaiting credentials to test
- **Rate limiter**: 55 requests per 60 seconds for FSP API calls
- **Snapshot persistence**: Moved from in-memory Map to database storage
- **Empty/error states**: Added to all UI views

## Quality Gates
- 551 tests passing across 47 test files
- Zero typecheck errors, zero lint violations
- All 4 workflows tested end-to-end against mock FSP data

## What's Next
1. **FSP Real Integration** — waiting on dev credentials (subscription key, write API access, test operator).
2. **Real API testing** — validate RealFspClient against live FSP endpoints.
3. **Auth** — currently mock mode only (middleware auto-injects operatorId: 1). Real auth TBD.
4. **Communication providers** — email/SMS interfaces are stubbed, need Twilio/SendGrid wiring.
5. **Deployment** — target Azure, no pipeline yet.

## Active Decisions
- See decisions/0001-project-bootstrap.md for stack choices
- See decisions/0002-technology-choices.md for technology selections
- See decisions/0003-ui-backend-wiring.md for UI wiring architecture
- See decisions/0004-autonomous-auto-approver.md for auto-approver design
- Background jobs: Inngest (decided, replaces deferred status)

## Blockers
- Waiting on FSP tech contact for: subscription key, write API access, test operator
- FSP public developer API is READ-ONLY; write endpoints (reservation creation, AutoSchedule, Find-a-Time) require internal API access
