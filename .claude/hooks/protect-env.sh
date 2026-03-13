#!/bin/bash
# protect-env.sh -- Block writes to .env files and other secret files
# PreToolUse hook for Edit|Write tools
# Exit 0 = allow, Exit 2 = block (stderr sent to Claude as feedback)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

PROTECTED_PATTERNS=(".env" ".env.local" ".env.production" ".env.staging" "credentials" "secrets")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$BASENAME" == *"$pattern"* ]]; then
    echo "BLOCKED: Cannot write to '$FILE_PATH' -- matches protected pattern '$pattern'. Secret files must be managed manually." >&2
    exit 2
  fi
done

exit 0
