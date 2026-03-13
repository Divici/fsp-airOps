---
name: pr
description: Pull request workflow for FSP Agentic Scheduler. Use when creating PRs, preparing branches for review, or when asked about PR format, branch naming, or review checklists.
---

# Pull Request Workflow

## Branch Naming

Format: `type/short-description`

Examples: `feat/reschedule-on-cancel`, `fix/tenant-isolation`, `refactor/fsp-client-types`

## PR Creation

```bash
gh pr create --title "type(scope): description" --body "$(cat <<'EOF'
## Summary
- Bullet points describing the change

## Changes
- `path/to/file.ext` -- what changed

## Test Plan
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Manual verification: [describe]

Generated with Claude Code
EOF
)"
```

## Review Checklist

### Code Quality
- [ ] No hardcoded secrets or API keys
- [ ] No commented-out code blocks
- [ ] Follows project conventions

### Testing
- [ ] New code has corresponding tests
- [ ] All tests pass
- [ ] Edge cases covered

### Tenant Safety
- [ ] All queries are scoped by operatorId
- [ ] No cross-tenant data access
- [ ] Background jobs run in tenant context

### Tooling
- [ ] Lint check passes
- [ ] Type check passes
- [ ] Tests pass

### Architecture
- [ ] No circular imports/dependencies
- [ ] Config in config files, not hardcoded
- [ ] FSP remains source of truth for reservations

### Git Hygiene
- [ ] Conventional commit format
- [ ] Atomic commits
- [ ] Branch name follows type/description convention
