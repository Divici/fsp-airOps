---
name: commit
description: Conventional commit format and pre-commit workflow for FSP Agentic Scheduler. Use when committing code, preparing changes for commit, or when asked about commit message format.
---

# Commit Standards

## Conventional Commit Format

```
type(scope): short description

Optional body explaining the "why" not the "what".

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Types

| Type       | When to use                                    |
|------------|------------------------------------------------|
| `feat`     | New feature or capability                      |
| `fix`      | Bug fix                                        |
| `refactor` | Code change that neither fixes nor adds        |
| `docs`     | Documentation only                             |
| `test`     | Adding or updating tests                       |
| `chore`    | Build process, dependencies, tooling, config   |

## Scopes

| Scope       | Area                                          |
|-------------|-----------------------------------------------|
| ui          | Frontend components, pages, layouts            |
| api         | Backend API routes and handlers                |
| engine      | Orchestration engine, workflow execution        |
| db          | Database schema, migrations, queries           |
| fsp-client  | FSP API client wrappers and types              |
| auth        | Authentication and session management          |
| comms       | Email/SMS communication services               |
| proposals   | Proposal model, generation, approval           |
| triggers    | Scheduling triggers and detection              |
| config      | Settings, environment, project config          |
| ci          | CI/CD pipelines                                |
| deps        | Dependency changes                             |
| decisions   | Architecture decision records                  |

## Pre-Commit Checklist

ALL must pass before committing:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Do not use `--no-verify` or skip checks.

## Atomic Commit Rules

- One logical change per commit
- Do not mix features with formatting
- Do not mix refactoring with new features
- Tests go in the same commit as the feature
- Dependency additions go with the code using them
