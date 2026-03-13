---
name: code-quality
description: Code quality standards for FSP Agentic Scheduler. Use when writing code, reviewing code, running quality checks, or when asked about linting, type checking, testing conventions, or code style.
---

# Code Quality Standards

## Quality Gate Commands

```bash
pnpm lint        # ESLint check
pnpm typecheck   # TypeScript strict mode check
pnpm test        # Vitest test runner
```

All three must pass before committing, creating PRs, or merging.

## Linter/Formatter

- ESLint with Next.js config
- Prettier for formatting
- Config in `.eslintrc.js` and `.prettierrc`

## Type Checking

- TypeScript strict mode enabled
- No `any` types unless explicitly justified
- Use Zod schemas for runtime validation at system boundaries (FSP API responses, user input)
- Drizzle provides type inference from schema -- don't duplicate types

## Testing

- Vitest as test runner
- Tests live next to source files: `foo.ts` -> `foo.test.ts`
- Integration tests in `__tests__/` directories
- Mock FSP API calls -- never hit real FSP in tests

## Module Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── (dashboard)/        # Authenticated dashboard routes
│   │   ├── queue/          # Approval queue (primary view)
│   │   ├── proposals/      # Proposal detail views
│   │   ├── discovery/      # Discovery flight intake management
│   │   ├── settings/       # Operator settings
│   │   └── activity/       # Audit/activity feed
│   ├── intake/             # Public discovery flight form
│   ├── api/                # API route handlers
│   └── layout.tsx          # Root layout
├── lib/
│   ├── fsp-client/         # Typed FSP API client + mock impl
│   ├── engine/             # Orchestration engine + workflows
│   ├── db/                 # Drizzle schema, migrations, queries
│   ├── auth/               # FSP auth integration
│   ├── comms/              # Email/SMS services
│   ├── ai/                 # AI provider (proposal assembly, rationale)
│   └── types/              # Shared types and schemas
├── components/             # React components
│   ├── ui/                 # Base UI components
│   ├── queue/              # Queue-specific components
│   └── proposals/          # Proposal-specific components
└── config/                 # App configuration
```

## Quality Checklist

Before considering code complete:
1. Lint check passes -- zero violations
2. Type check passes -- zero errors
3. All tests pass
4. New code has tests
5. No secrets or credentials in code
6. All queries are tenant-scoped by operatorId
7. FSP API calls use typed client wrappers
