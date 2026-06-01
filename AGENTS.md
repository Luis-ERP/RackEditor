# AGENTS.md — Persistent instructions for all AI coding agents in this repo.
# Loaded automatically by Claude Code, GitHub Copilot CLI, and compatible tools.

## What this project is

RackEditor is a **production web application** for designing selective pallet rack
layouts, deriving Bills of Materials, and producing customer quotes with full audit
trails. It is NOT a prototype. Every commit lands in a codebase maintained long-term.

Stack:
- Frontend: Next.js 14 (App Router, JavaScript) — `apps/web/`
- Backend:  Django + DRF (Python) — `apps/api/`
- Database: PostgreSQL

Run commands are in `docs/runbook.md`.

---

## Non-negotiable quality rules

1. **No broken builds.** Every commit must pass:
   - `cd apps/web && npm run lint`
   - `cd apps/web && npm run build`
   - `cd apps/api && python manage.py test`

2. **No duplicate implementations.** Search the codebase before writing new code.
   A feature that already exists somewhere is NOT missing — find and extend it.

3. **No weakening tests.** Never delete, skip, or comment out an existing test.
   If a test is wrong, fix the test and the code together and explain why.

4. **Small, focused commits.** One logical change per commit.
   Format: `feat(<app>): <what>` or `fix(<app>): <what>` or `refactor(<app>): <what>`.

5. **Leave the codebase better than you found it.** Fix obvious issues you encounter
   even if they are not your primary task. Note them in progress.txt.

6. **Document the why.** Inline comments only where the reasoning isn't obvious.
   Test docstrings must explain *why* the test exists, not just what it does.

---

## Domain rules (enforce these everywhere)

- Geometry and BOM must be **derived from the semantic domain model**, never from
  canvas/pixel coordinates. See `specs/business-rules.md` and `specs/model-schema.md`.
- Rack validation rules live in `apps/api/cad/validators.py`. UI must surface every
  error and warning from the API — never swallow or hide validation responses.
- Quote revisions are **immutable once sent**. Never mutate a sent revision.
- Override actions (quantity, price, discount) require audit metadata: who, when, why.

---

## Ralph loop behavior

When running as part of a Ralph loop (PROMPT.md):
- Read `prd.json` and `progress.txt` first — always.
- Pick ONE `"passes": false` item.
- Only mark `"passes": true` after all feedback loops pass.
- Append to `progress.txt` before committing.
- Output `<done/>` only when every item in `prd.json` has `"passes": true`.
