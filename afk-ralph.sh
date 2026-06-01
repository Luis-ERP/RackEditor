#!/usr/bin/env bash
# afk-ralph.sh — Run Ralph in a loop up to MAX iterations (AFK / unsupervised mode).
# Stops early if the agent emits <done/>.
# Usage: ./afk-ralph.sh [max_iterations]   (default: 10)
#
# Safety: cap iterations; never run with no limit on a stochastic system.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
MAX="${1:-10}"

echo "=== AFK Ralph — up to $MAX iterations ==="
echo "Repo: $REPO_ROOT"
echo "Started: $(date)"
echo ""

cd "$REPO_ROOT"

for ((i = 1; i <= MAX; i++)); do
  echo ""
  echo "────────────────────────────────────────"
  echo " Iteration $i / $MAX  —  $(date '+%H:%M:%S')"
  echo "────────────────────────────────────────"

  result=$(claude --dangerously-skip-permissions -p "$(cat PROMPT.md)" 2>&1)
  echo "$result"

  if [[ "$result" == *"<done/>"* ]]; then
    echo ""
    echo "✅  All PRD items complete. Ralph is done."
    exit 0
  fi
done

echo ""
echo "⏹  Reached max iterations ($MAX). Review progress.txt and prd.json, then rerun."
exit 0
