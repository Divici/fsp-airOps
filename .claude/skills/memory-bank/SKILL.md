---
name: memory-bank
description: Memory bank for cross-session knowledge persistence in FSP Agentic Scheduler. Use at the start of every session to load project context, after completing significant work to update progress, when making architectural decisions, or when explicitly asked to "update memory bank".
---

# Memory Bank

The memory bank persists project knowledge across sessions. All files live in `memory-bank/` at the project root and are committed to git.

## Session Start Protocol

At the start of every session, read ALL memory bank files:

```
memory-bank/project-brief.md    -> project scope, goals, requirements
memory-bank/product-context.md  -> why we're building this, UX goals
memory-bank/system-patterns.md  -> architecture, design patterns, components
memory-bank/tech-context.md     -> tech stack, dependencies, constraints
memory-bank/active-context.md   -> current priorities, recent changes, next steps
memory-bank/progress.md         -> what's done, what's remaining, known issues
```

Read active-context.md and progress.md first -- they tell you where we left off.

## When to Update

| Trigger | Files to Update |
|---------|----------------|
| After merging agent work | progress.md, active-context.md |
| New architectural decision | system-patterns.md + create decisions/NNNN-*.md |
| New technology/dependency added | tech-context.md |
| Scope or requirements change | project-brief.md |
| UX or product direction change | product-context.md |
| Explicit "update memory bank" request | Review and update ALL files |
| Discovering new patterns | system-patterns.md |

## Update Rules

- **Update, don't append.** Rewrite sections to reflect current state. Remove stale information.
- **Keep files concise.** Each file should be scannable in under 30 seconds.
- **Be specific.** Include file paths, function names, concrete details -- not vague descriptions.
- **Track what changed.** In active-context.md, note what was just completed and what's next.
- **Progress is authoritative.** progress.md is the single source of truth for what's done vs remaining.
