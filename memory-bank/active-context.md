# Active Context: FSP Agentic Scheduler

## Current Phase
All 6 implementation phases complete. MVP is feature-complete and UI-wired. Awaiting FSP dev credentials for real integration.

## Active Plan
See `memory-bank/plans/mvp-implementation-plan.md` and `.claude/plans/functional-tinkering-fairy.md`.

## Just Completed
- Phase 1: Foundation (10 tasks) — scaffold, DB schema, types, FSP mock, tenant, audit, config, app shell
- Phase 2: Core Engine + Reschedule (12 tasks) — orchestrator, proposals, triggers, reschedule workflow, AI rationale, approval API/UI, reservation executor, cancellation detection, E2E test
- Phase 3: Discovery Flight Booking — prospect model + API, intake form at /book/[id], discovery flight workflow with daylight filtering, discovery management UI
- Phase 4: Schedule Next Lesson — enrollment resolver, next-lesson workflow, lesson completion detection, training context display
- Phase 5: Waitlist Automation — candidate finder, eligibility checker, weighted ranking, waitlist workflow, opening detection, operator settings UI, batch approval
- Phase 6: Hardening — audit feed UI, communication service (provider stubs), feature flags, observability (logger, correlation context, metrics collector), proposal expiration cron, dashboard metrics

### UI Wiring Session (latest)
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

## Quality Gates
- 518 tests passing across 43 test files
- Zero typecheck errors, zero lint violations
- All 4 workflows tested end-to-end against mock FSP data

## What's Next
1. **FSP Real Integration** — waiting on dev credentials (subscription key, write API access, test operator). Message sent to FSP technical contact.
2. **Auth** — currently mock mode only (middleware auto-injects operatorId: 1). Real auth TBD.
3. **Communication providers** — email/SMS interfaces are stubbed, need Twilio/SendGrid wiring.
4. **Snapshot persistence** — currently in-memory Map (lost on restart), needs durable store.
5. **Deployment** — target Azure, no pipeline yet.

## Active Decisions
- See decisions/0001-project-bootstrap.md for stack choices
- See decisions/0002-technology-choices.md for technology selections
- Background jobs: Inngest (decided, replaces deferred status)

## Blockers
- No FSP dev credentials — mock-first approach mitigates this. Request sent to FSP contact.
- FSP public developer API is READ-ONLY; write endpoints (reservation creation, AutoSchedule, Find-a-Time) require internal API access
