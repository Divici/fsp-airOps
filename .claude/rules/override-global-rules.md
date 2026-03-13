# Global Rule Overrides for This Project

The following global user-level rules are **paused** for this project. If they conflict with project-level instructions, ignore the global rule and follow the project CLAUDE.md instead.

## Paused: TDD Rule (`~/.claude/rules/tdd.md`)
- Do NOT enforce strict red-green-refactor TDD workflow in this project.
- Tests are still valuable and should be written, but the rigid "failing test first" requirement is relaxed.
- Write tests when they add value — not as a mandatory gate before every implementation.

## Paused: Auto-Commit Rule (`~/.claude/rules/commit-message.md`)
- Do NOT automatically stage and commit after every task.
- Only commit when explicitly asked or when the orchestration workflow calls for it.
- When committing, still use conventional commit format from the project's commit skill.

## Active: Study Guide Rule (`~/.claude/rules/study-guide.md`)
- Still active. Update STUDY_GUIDE.md after significant implementation work or architecture decisions.

## Active: Lightweight Decoupling Rule (`~/.claude/rules/lightweight-decoupling.md`)
- Still active. Follow the extraction and module structure guidelines.
