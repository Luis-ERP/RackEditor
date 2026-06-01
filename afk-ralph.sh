#!/usr/bin/env bash
# afk-ralph.sh — Run Ralph in a loop (AFK mode)
#
# Runs Claude Code autonomously for up to N iterations. Each iteration picks
# one task from prd.json, implements it, commits, and updates progress.txt.
# Stops early if Claude outputs <promise>COMPLETE</promise>.
#
# Usage:
#   ./afk-ralph.sh <iterations>
#
# Examples:
#   ./afk-ralph.sh 5    # run up to 5 iterations (small task set)
#   ./afk-ralph.sh 20   # run up to 20 iterations (full migration)
#
# Requirements:
#   - Claude Code CLI installed and authenticated (claude)
#   - Run from the repository root
#
# Safety: cap iterations to avoid runaway loops. Start with 5 while building
# confidence in your prompt, then increase once results are consistent.

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  echo "Example: $0 5"
  exit 1
fi

ITERATIONS="$1"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "=== AFK Ralph ==="
echo "Working directory: $(pwd)"
echo "Max iterations: $ITERATIONS"
echo ""

for ((i=1; i<=ITERATIONS; i++)); do
  echo "--- Iteration $i / $ITERATIONS ($(date '+%H:%M:%S')) ---"

  # Run fully unattended: bypass interactive permission prompts.
  result=$(claude --permission-mode bypassPermissions -p "$(cat PROMPT.md)")

  echo "$result"
  echo ""

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "=== All PRD items complete. Ralph is done. ==="
    exit 0
  fi

  echo "Iteration $i complete. Starting next..."
  echo ""
done

echo "=== Reached max iterations ($ITERATIONS). Review prd.json for remaining work. ==="
