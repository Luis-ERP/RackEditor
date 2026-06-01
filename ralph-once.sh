#!/usr/bin/env bash
# ralph-once.sh — Run ONE Ralph iteration (human-in-the-loop mode).
# Use this while learning or refining PROMPT.md. Watch what it does; intervene if needed.
# Usage: ./ralph-once.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Ralph (HITL — single iteration) ==="
echo "Repo: $REPO_ROOT"
echo ""

cd "$REPO_ROOT"

# Run claude with the prompt file. --dangerously-skip-permissions lets it
# edit files and run commands without asking for each action.
gh copilot suggest -t shell "$(cat PROMPT.md)" || \
  claude --dangerously-skip-permissions -p "$(cat PROMPT.md)"
