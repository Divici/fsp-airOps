# Active Context: FSP Agentic Scheduler

## Current Phase
Implementation Phase 1: Foundation. Starting Task 1.1 (Project Scaffold).

## Active Plan
See `memory-bank/plans/mvp-implementation-plan.md` and `.claude/plans/functional-tinkering-fairy.md`.

## Just Completed
- Finalized MVP implementation plan (48 tasks, 6 phases)
- Locked technology decisions: Shadcn/ui, Inngest, date-fns-tz, FSP credential proxy, TanStack Query
- Recorded decisions in `decisions/0002-technology-choices.md`

## Next Steps (Phase 1: Foundation)
1. **Task 1.1** — Project scaffold (Next.js + TS + ESLint + Vitest + Tailwind + Inngest + Shadcn/ui)
2. **Task 1.9** — App shell and layout (parallel with backend tasks)
3. **Task 1.2** — Docker Compose + PostgreSQL + Drizzle ORM
4. **Task 1.3** — Core database schema (all app-owned entities)
5. **Tasks 1.4–1.8** — Types, FSP mock client, tenant context, audit, config
6. **Task 1.10** — Foundation integration test

## Active Decisions
- See decisions/0001-project-bootstrap.md for stack choices
- See decisions/0002-technology-choices.md for technology selections
- Background jobs: Inngest (decided, replaces deferred status)

## Blockers
- No FSP dev credentials yet -- mock-first approach mitigates this
