#!/usr/bin/env bash
# afk-ralph.sh — Run Ralph in a loop up to MAX iterations (AFK / unsupervised mode).
# Stops early if the agent emits <done/>.
# Usage: ./afk-ralph.sh [max_iterations]   (default: 10)
#
# Safety: cap iterations; never run with no limit on a stochastic system.
#
# PERMISSIONS WARNING:
#   By default this script runs the agent WITHOUT --dangerously-skip-permissions,
#   meaning the agent will pause to ask before each destructive action.
#   To grant the agent full autonomy (AFK mode), set:
#     export RALPH_SKIP_PERMISSIONS=1
#   Only do this after you have validated the prompt with ralph-once.sh and you
#   trust the agent's behavior. A misbehaving prompt + skip-permissions can
#   modify files, run arbitrary commands, and commit bad code unattended.

set -uo pipefail
# Note: -e is intentionally omitted. The agent may exit non-zero (e.g. transient
# API error, lint failure it couldn't fix). We capture the exit code explicitly
# and decide per-iteration whether to continue, rather than aborting the whole loop.

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
MAX="${1:-10}"

# Build the permissions flag only when explicitly opted in.
PERMISSIONS_FLAG=""
if [[ "${RALPH_SKIP_PERMISSIONS:-0}" == "1" ]]; then
  PERMISSIONS_FLAG="--dangerously-skip-permissions"
  echo "⚠️  RALPH_SKIP_PERMISSIONS=1 — running without interactive permission gates."
  echo "   The agent can edit files, run commands, and commit without prompting."
  echo ""
fi

echo "=== AFK Ralph — up to $MAX iterations ==="
echo "Repo: $REPO_ROOT"
echo "Started: $(date)"
echo ""

cd "$REPO_ROOT"

failures=0

for ((i = 1; i <= MAX; i++)); do
  echo ""
  echo "────────────────────────────────────────"
  echo " Iteration $i / $MAX  —  $(date '+%H:%M:%S')"
  echo "────────────────────────────────────────"

  # Capture output and exit code separately so a non-zero exit doesn't kill the loop.
  result=""
  exit_code=0
  # shellcheck disable=SC2086
  result=$(claude $PERMISSIONS_FLAG -p "$(cat PROMPT.md)" 2>&1) || exit_code=$?

  echo "$result"

  if [[ $exit_code -ne 0 ]]; then
    failures=$((failures + 1))
    echo ""
    echo "⚠️  Agent exited with code $exit_code on iteration $i (total failures: $failures)."
    if [[ $failures -ge 3 ]]; then
      echo "❌  3 consecutive-or-total failures — stopping to avoid runaway loop."
      echo "    Review the output above, fix PROMPT.md or the codebase, then rerun."
      exit 1
    fi
    echo "    Continuing to next iteration..."
    continue
  fi

  # Reset failure counter on a clean iteration.
  failures=0

  if [[ "$result" == *"<done/>"* ]]; then
    echo ""
    echo "✅  All PRD items complete. Ralph is done."
    exit 0
  fi
done

echo ""
echo "⏹  Reached max iterations ($MAX). Review progress.txt and prd.json, then rerun."
exit 0
