# 0001: Project Bootstrap

**Date:** 2026-03-13
**Status:** accepted

## Context
Setting up the development workflow and stack for the FSP Agentic Scheduler -- an AI-assisted scheduling optimization console for flight schools. The product integrates with Flight Schedule Pro (FSP) APIs and needs to support multi-tenant operations at scale (~1,300 operators, ~20,000 daily flights).

## Decision
Adopted the following stack and workflow:

- **Framework:** Next.js (App Router) -- single application with organized `src/lib/` modules
- **Language:** TypeScript 5.x with strict mode
- **Package Manager:** pnpm
- **Database:** PostgreSQL via Docker Compose (local dev), Drizzle ORM
- **AI Provider:** OpenAI (GPT-4o) for proposal assembly and rationale generation
- **Testing:** Vitest with TDD workflow (red-green-refactor)
- **Architecture:** Hybrid AI + deterministic -- deterministic for scheduling correctness, AI for orchestration and explainability
- **FSP Integration:** Mock-first development with typed client interfaces
- **Tenancy:** Shared deployment, strict operatorId scoping on every record/query
- **Background Jobs:** Deferred -- engine designed to be trigger-agnostic

## Consequences
- Single Next.js app keeps MVP simple; may need to extract worker processes later
- Mock-first FSP integration enables development without credentials but delays real integration testing
- OpenAI chosen over Claude API per user preference; can swap via abstraction layer if needed
- Drizzle provides type-safe queries with minimal overhead; less ecosystem than Prisma but lighter
- Background job model deferred -- this is fine for MVP but must be decided before production

## Alternatives Considered
- **pnpm workspace monorepo** -- rejected for MVP; adds config overhead without enough benefit at current scale
- **Separate frontend + API** -- rejected; Next.js handles both well for MVP
- **Prisma** -- rejected in favor of Drizzle for lighter runtime and SQL-like API
- **Claude API** -- not chosen; user selected OpenAI
- **BullMQ + Redis for jobs** -- deferred, not rejected; may be adopted later
