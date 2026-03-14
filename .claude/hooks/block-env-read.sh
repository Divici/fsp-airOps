#!/usr/bin/env bash
# Pre-hook: block reading .env files
INPUT=$(cat)
FILE=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
BASENAME=$(basename "$FILE")
case "$BASENAME" in
  .env|.env.*)
    echo "BLOCK: Reading .env files is not allowed"
    exit 2
    ;;
esac
