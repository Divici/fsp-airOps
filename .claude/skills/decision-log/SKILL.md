---
name: decision-log
description: Lightweight Architecture Decision Records for FSP Agentic Scheduler. Use when making significant technical or architectural decisions, when asked about past decisions, or when evaluating trade-offs.
---

# Decision Log

Lightweight ADRs stored in `decisions/` at the project root, committed to git.

## When to Log a Decision

- Choosing between competing technologies or approaches
- Establishing a new pattern or convention
- Deviating from or superseding a previous decision
- Making a trade-off with consequences worth remembering
- Any decision a future session would benefit from knowing

## File Format

File naming: `decisions/NNNN-short-title.md` (zero-padded, sequential)

### Template

```markdown
# NNNN: Short Title

**Date:** YYYY-MM-DD
**Status:** accepted | superseded by NNNN | deprecated

## Context
What is the situation? What forces are at play?

## Decision
What did we decide? Be specific.

## Consequences
- What becomes easier?
- What becomes harder?
- What are the risks?

## Alternatives Considered
Brief notes on what else was evaluated and why it was rejected.
```

## Integration with Workflow

- **Orchestrator**: Before making a decision that matches the triggers above, check `decisions/` for related past decisions. Reference them in the new decision if relevant.
- **Memory bank**: After creating a new decision, update `memory-bank/system-patterns.md` if the decision introduces or changes an architectural pattern.
- **Commit**: Decision log entries use type `docs(decisions)`.
- **Agents**: When dispatching an agent for work related to a past decision, include the decision file path in the agent prompt so the agent has full context.

## Querying Decisions

- Scan filenames in `decisions/` for relevant titles
- Grep for keywords: `grep -rl "keyword" decisions/`
- Read active decisions when evaluating related trade-offs
