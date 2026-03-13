# Active Context: FSP Agentic Scheduler

## Current Phase
Project bootstrap complete. Ready for first feature implementation.

## Just Completed
- Bootstrapped agentic development workflow
- Created .claude/ config, skills (orchestration, decision-log), hooks
- Initialized memory bank and decision log
- Made key stack decisions: pnpm + Next.js + Drizzle + PostgreSQL + OpenAI + Vitest

## Next Steps
1. Scaffold Next.js project with pnpm, configure ESLint/Prettier/Vitest/Drizzle
2. Set up Docker Compose for PostgreSQL
3. Define Drizzle schema for app-owned entities (from PRESEARCH section 16)
4. Build typed FSP API client interfaces + mock implementations
5. Implement first workflow: Reschedule on Cancellation (anchor workflow)

## Active Decisions
- See decisions/0001-project-bootstrap.md for initial setup choices
- Background job execution model intentionally deferred

## Blockers
- No FSP dev credentials yet -- mock-first approach mitigates this
