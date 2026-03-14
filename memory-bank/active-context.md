# Active Context: FSP Agentic Scheduler

## Current Phase
Implementation Phases 3+4 (parallel): Discovery Flight Booking + Schedule Next Lesson.

## Active Plan
See `memory-bank/plans/mvp-implementation-plan.md` and `.claude/plans/functional-tinkering-fairy.md`.

## Just Completed
- Phase 1: Foundation (10 tasks) — scaffold, DB schema, types, FSP mock, tenant, audit, config, app shell
- Phase 2: Core Engine + Reschedule (12 tasks) — orchestrator, proposals, triggers, reschedule workflow, AI rationale, approval API/UI, reservation executor, cancellation detection, E2E test
- 264 tests passing, all quality gates green

## Next Steps (Phases 3+4 parallel)
### Phase 3: Discovery Flight Booking
1. **Task 3.1** — Prospect request model and API
2. **Task 3.2** — Discovery flight intake form
3. **Task 3.3** — Discovery flight workflow handler
4. **Task 3.4** — Register discovery workflow in engine
5. **Task 3.5** — Discovery flight management UI
6. **Task 3.6** — Discovery flight E2E test

### Phase 4: Schedule Next Lesson
1. **Task 4.1** — Enrollment and progress integration
2. **Task 4.2** — Next lesson workflow handler
3. **Task 4.3** — Register workflow + trigger API + detection
4. **Task 4.4** — Next lesson UI enhancements
5. **Task 4.5** — Next lesson E2E test

## Active Decisions
- See decisions/0001-project-bootstrap.md for stack choices
- See decisions/0002-technology-choices.md for technology selections
- Background jobs: Inngest (decided, replaces deferred status)

## Blockers
- No FSP dev credentials yet -- mock-first approach mitigates this
