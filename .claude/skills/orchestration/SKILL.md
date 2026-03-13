---
name: orchestration
description: Agent orchestration patterns for FSP Agentic Scheduler. Use when starting work on features, planning task decomposition, dispatching agents, coordinating parallel work, managing worktrees, reviewing agent output, or handling agent failures.
---

# Orchestration Patterns

## Feature Decomposition

1. **Identify layers.** Most features touch: data model, business logic, UI/API, tests.
2. **Identify dependencies.** Which tasks must complete before others can start?
3. **Size tasks.** Each task = one agent session. If description exceeds 3 paragraphs, split further.
4. **Create tasks.** Use TaskCreate with clear acceptance criteria.

### Example

```
Task 1: Create data model                    [independent]
Task 2: Create business logic                [blocked by 1]
Task 3: Create API/UI layer                  [blocked by 2]
Task 4: Create storage adapter               [independent]
Task 5: Wire end-to-end                      [blocked by 1-4]
Task 6: Add CLI/entry point                  [blocked by 5]
```

## Agent Dispatch

### Parallel (independent tasks)

```
For each independent task:
  1. TaskUpdate -> in_progress
  2. Dispatch Agent with isolation: "worktree"
  3. Include in prompt: task description + relevant skill names
```

### Sequential (dependent tasks)

```
1. Dispatch agent for Task A
2. When A completes and checks pass -> merge worktree
3. TaskUpdate A -> completed
4. TaskUpdate B -> in_progress
5. Dispatch agent for Task B
```

### Agent Prompt Template

When dispatching an agent, always include:

```
Task: [clear description with acceptance criteria]

Follow these skills:
- tdd-workflow: write failing tests first, then implement
- code-quality: lint, typecheck, test standards
- [domain skill if relevant]

Working directory: [worktree path]
Run `pnpm install` before starting.
Run `pnpm lint && pnpm typecheck && pnpm test` before finishing.

If this task relates to a past decision, see: decisions/NNNN-relevant-title.md
```

## Worktree Workflow

### Create and dispatch

Use `isolation: "worktree"` parameter in the Agent tool call. This automatically creates an isolated git worktree for the agent.

### Verify (pre-merge)

After agent completes, run in the worktree:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

### Auto-merge decision

```
All checks pass?
  YES -> merge with: git merge --no-ff <branch> -m "<conventional commit>"
         clean up worktree and branch
  NO  -> send errors back to agent (up to 2 retries)
         if still failing -> escalate to orchestrator
```

### Cleanup

```bash
git worktree remove <worktree-path>
git branch -d <branch-name>
```

IMPORTANT: Always clean up worktrees and branches immediately after merging. Do not leave stale worktrees accumulating.

### CRITICAL: Nested Worktree Warning

Agents spawned while CWD is inside a worktree will create NESTED worktrees. This causes merge conflicts because nested worktrees branch from the parent worktree, not from main. Always ensure agents are spawned from the MAIN working tree.

### Update After Merge

After merging agent work:
1. Update `memory-bank/progress.md` -- mark completed features, add known issues
2. Update `memory-bank/active-context.md` -- shift priorities, note what's next
3. If new architectural pattern was introduced, update `memory-bank/system-patterns.md` AND create a `decisions/NNNN-*.md` entry

## Plan Persistence

All plans must be saved to `memory-bank/plans/` as markdown files with descriptive names (e.g., `memory-bank/plans/reschedule-on-cancellation.md`). This ensures plans survive context clears.

When creating a plan:
1. Write the plan to `memory-bank/plans/{descriptive-name}.md`
2. Reference it in `memory-bank/active-context.md` under "Active Plan"
3. As tasks complete, update the plan file (mark steps done, add notes)

When resuming after context clear:
1. Read `memory-bank/active-context.md` to find the active plan
2. Read the plan file to see what's done and what remains
3. Continue from where the plan left off

## Context Handoff Protocol

The context-guard hook (PostToolUse) fires a warning when context usage reaches 58%. When you see this warning:

1. **Stop at the nearest clean boundary.** Finish your current atomic unit of work (complete the current agent merge, finish the current file edit). Do NOT start new tasks or dispatch new agents.

2. **Write continuation state to `memory-bank/active-context.md`:**
   ```markdown
   ## Continuation State
   ### What Was Being Done
   [Current task/plan name and description]

   ### Done So Far
   - [Specific: files created, tests passing, agents merged, etc.]

   ### What Remains
   - [Specific next steps, in order]

   ### Key Context for Resumption
   - [File paths that matter]
   - [Decisions made during this session]
   - [Gotchas or issues discovered]
   - [Branch state, pending worktrees, unmerged agents]

   ### Active Plan
   See: memory-bank/plans/{plan-name}.md
   ```

3. **Update the plan file** in `memory-bank/plans/` - mark completed steps, add notes about in-progress work.

4. **Tell the user:**
   > Context is at {X}%. I've saved continuation state to `memory-bank/active-context.md`. Clear context with `/clear` and say "resume" to pick up where I left off.

### Resuming After Context Clear

When the user says "resume" or starts a new session:
1. Follow the memory-bank session start protocol (read all memory-bank/ files)
2. Read `memory-bank/active-context.md` - the "Continuation State" section tells you exactly where to pick up
3. Read the active plan file
4. Continue execution from the next incomplete step

### Context Budget Guidelines

- **0-20%**: Context building - reading files, understanding codebase, loading memory bank
- **20-58%**: Active work - the productive window for dispatching agents and merging
- **58%+**: Handoff zone - stop new work, write continuation state
- **90%**: Claude auto-compresses (lossy) - you want to be done well before this

## Review Criteria

Before merging an agent's work:

1. **Task complete** -- acceptance criteria met
2. **Quality gates pass** -- all three checks green
3. **Tests exist** -- every new module has tests
4. **No scope creep** -- only changed what's in the task
5. **No secrets** -- no API keys or credentials in code

## Error Handling

### Agent fails quality checks
1. Send error output back to agent
2. Agent gets up to 2 retries
3. If still failing -> orchestrator intervenes

### Agent produces wrong output
1. Do NOT merge
2. Create new task with correction instructions
3. Dispatch new agent

### Merge conflicts
1. Do NOT auto-merge
2. Orchestrator resolves conflicts
3. Re-run quality checks
4. Then merge

## Task Status Flow

```
pending -> in_progress -> completed
               |
          (blocked) -> create blocker task -> resolve -> resume
```

Always update task status:
- `in_progress` BEFORE dispatching the agent
- `completed` ONLY after merge is done
- Never mark completed if checks are failing
