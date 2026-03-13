# FSP Agentic Scheduler - Development Rules

## Dev Cycle

Plan -> Tasks -> Agents -> Review -> Merge

1. **Plan**: Decompose work into discrete tasks using TaskCreate/TaskUpdate.
2. **Tasks**: Each task = one agent in an isolated worktree.
3. **Agents**: Dispatch via Agent tool. Parallel when independent, sequential when dependent.
4. **Review**: Verify each agent's output: all quality gates must pass.
5. **Merge**: Auto-merge worktrees when all checks pass. Stop and review on failure.

## Core Rules

- **Delegate, don't implement.** The orchestrator plans, decomposes, dispatches, and reviews. It does not write application code directly unless the fix is trivial (< 5 lines). All coding is done by spawned agents.
- **Use pnpm for everything.** Never use npm-global or other direct installers.
- **Conventional commits.** `type(scope): description`. See commit skill.
- **TDD is default.** Red-green-refactor. Write failing test first, then implement, then clean up. See tdd-workflow skill.
- **Worktrees for isolation.** Each agent gets its own git worktree. Never edit the main working tree directly from an agent.
- **Reference skills in agent prompts.** Always name relevant skills when dispatching agents so they load automatically.
- **Memory bank.** Read all `memory-bank/` files at session start. Update after completing significant work. See memory-bank skill.
- **Decision log.** Record significant architectural and technical decisions in `decisions/`. See decision-log skill.
- **Plan persistence.** All plans must be written to `memory-bank/plans/` with descriptive filenames. Reference the active plan in `memory-bank/active-context.md`.
- **Context management.** The context-guard hook warns at 58% usage. When warned, follow the Context Handoff Protocol: finish current atomic work, write continuation state to `memory-bank/active-context.md`, save the plan to `memory-bank/plans/`, and tell the user to clear context.

## Auto-Merge Conditions

Merge an agent's worktree when ALL pass:
1. `pnpm lint` -- zero violations
2. `pnpm typecheck` -- zero errors
3. `pnpm test` -- all tests pass

If any fails, the agent must fix or escalate to the orchestrator.

## Project Context

This is an AI-assisted scheduling optimization console for flight schools that integrates with Flight Schedule Pro (FSP). Phase 1 MVP is suggest-and-approve only — all schedule mutations require human approval.

### Key Architectural Rules
- FSP is the source of truth for reservations and resources. This app owns derived artifacts only.
- Every record is tenant-scoped by `operatorId`. No cross-tenant data access.
- No autonomous schedule mutations in MVP — always suggest-and-approve.
- Validate-then-create pattern for all reservation execution.
- Hybrid AI + deterministic: deterministic for scheduling correctness, AI for orchestration and explainability.

### FSP API Integration
- FSP APIs require Bearer token auth + x-subscription-key header.
- Reservation create uses local time (no timezone suffix), not UTC.
- AutoSchedule solver returns UTC — convert using timeZoneOffset.
- Mock-first development: use typed mock implementations until FSP dev credentials are available.

## Skills Reference

| Skill | Purpose |
|-------|---------|
| orchestration | Agent dispatch, worktree workflow, task management |
| commit | Conventional commit format and pre-commit checklist |
| pr | Branch naming, PR template, review checklist |
| tdd-workflow | Red-green-refactor TDD cycle |
| code-quality | Lint, typecheck, test config and standards |
| memory-bank | Session start protocol, knowledge persistence |
| decision-log | Architecture decision records |
