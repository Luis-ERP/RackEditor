#!/usr/bin/env bash
# ralph-once.sh — Run one Ralph iteration (HITL mode)
#
# Use this while learning or refining your prompt. Watch what Ralph does
# and intervene when needed. Good for prompt development and risky tasks.
#
# Usage:
#   ./ralph-once.sh
#
# Requirements:
#   - Claude Code CLI installed and authenticated (claude)
#   - Run from the repository root

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "=== Ralph (single iteration) ==="
echo "Working directory: $(pwd)"
echo ""

claude -p "$(cat PROMPT.md)"
