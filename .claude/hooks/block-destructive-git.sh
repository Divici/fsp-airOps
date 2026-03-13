#!/bin/bash
# block-destructive-git.sh -- Block destructive git commands
# PreToolUse hook for Bash tool
# Exit 0 = allow, Exit 2 = block (stderr sent to Claude as feedback)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block: git push --force / -f
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*(-f|--force)'; then
  echo "BLOCKED: Force push is not allowed. Use regular 'git push' instead." >&2
  exit 2
fi

# Block: git reset --hard
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  echo "BLOCKED: 'git reset --hard' is not allowed. Use 'git stash' or 'git checkout -- <file>' for targeted changes." >&2
  exit 2
fi

# Block: git clean -f
if echo "$COMMAND" | grep -qE 'git\s+clean\s+-[a-zA-Z]*f'; then
  echo "BLOCKED: 'git clean -f' is not allowed. Remove untracked files manually." >&2
  exit 2
fi

# Block: git branch -D on main/master
if echo "$COMMAND" | grep -qE 'git\s+branch\s+-D\s+(main|master)'; then
  echo "BLOCKED: Cannot delete the main/master branch." >&2
  exit 2
fi

exit 0
