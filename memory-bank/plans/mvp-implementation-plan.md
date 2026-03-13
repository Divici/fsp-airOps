# FSP Agentic Scheduler — MVP Implementation Plan

Canonical plan location: `.claude/plans/functional-tinkering-fairy.md`

## Summary

48 tasks across 6 phases. Follows PRESEARCH §12 build order.

## Technology Decisions (locked 2026-03-13)

1. UI: Shadcn/ui
2. Jobs: Inngest
3. Timezone: date-fns-tz
4. Auth: FSP credential proxy
5. Client state: Server Components + TanStack Query

## Phases

1. **Foundation** (10 tasks) — scaffold, DB, FSP mock, tenant, audit, app shell
2. **Core Engine + Reschedule** (12 tasks) — orchestrator, proposal lifecycle, Find-a-Time, approval queue
3. **Discovery Flight** (6 tasks) — intake form, workflow, management UI *(parallel with Phase 4)*
4. **Next Lesson** (5 tasks) — enrollment resolver, workflow, training context UI *(parallel with Phase 3)*
5. **Waitlist** (7 tasks) — candidate ranking, AutoSchedule, settings UI, batch approval
6. **Hardening** (8 tasks) — audit UI, comms, feature flags, observability, polish
