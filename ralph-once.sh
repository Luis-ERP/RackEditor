#!/usr/bin/env bash
# ralph-once.sh — Run ONE Ralph iteration (human-in-the-loop mode).
#
# Use this while learning or refining PROMPT.md. Watch what the agent does
# in real time and intervene (Ctrl-C) if it goes off-track.
# Once the prompt feels stable, graduate to: ./afk-ralph.sh <iterations>
#
# Usage: ./ralph-once.sh
#
# Permissions:
#   By default the agent will pause before each destructive action.
#   To let it run uninterrupted, set RALPH_SKIP_PERMISSIONS=1:
#     RALPH_SKIP_PERMISSIONS=1 ./ralph-once.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

PERMISSIONS_FLAG=""
if [[ "${RALPH_SKIP_PERMISSIONS:-0}" == "1" ]]; then
  PERMISSIONS_FLAG="--dangerously-skip-permissions"
  echo "⚠️  RALPH_SKIP_PERMISSIONS=1 — running without interactive permission gates."
  echo ""
fi

echo "=== Ralph (HITL — single iteration) ==="
echo "Repo: $REPO_ROOT"
echo ""

cd "$REPO_ROOT"

# shellcheck disable=SC2086
claude $PERMISSIONS_FLAG -p "$(cat PROMPT.md)"
