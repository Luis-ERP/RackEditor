# RackEditor — Ralph Prompt

# This file is loaded every loop iteration.
# Keep it focused: one task per loop, always.

## Context (read every loop)

@specs/project-requirements.md
@specs/business-rules.md
@specs/model-schema.md
@specs/frontend-checklist.md
@specs/cad-export.md
@specs/known-gaps.md
@prd.json
@progress.txt

## Your task this iteration

1. Read `prd.json` and `progress.txt` to understand what is done and what remains.
2. Read `git log --oneline -20` to see recent commits.
3. Pick **ONE** failing PRD item (`"passes": false`). Choose the highest-priority, highest-risk item — not the first in the list.
4. Before writing any code, **search the codebase** using subagents to confirm the feature is not already implemented. Do NOT assume it is missing.
5. Implement only that one item. Keep changes small and focused.
6. Run ALL feedback loops — fix every failure before proceeding:
   - `cd apps/web && npm run lint`
   - `cd apps/web && npm run build`
7. Only after all feedback loops pass: set `"passes": true` for the item in `prd.json`.
8. Commit with a clear message: `feat(<category>): <description>` or `fix(<category>): <description>`.
9. Append a brief entry to `progress.txt` (see format below).
10. If every item in `prd.json` has `"passes": true`, output `<done/>` and stop.

## Subagent rules

- Use parallel subagents freely for **searching files** and **reading code**.
- Use **only one subagent** for build/test runs to avoid back-pressure.
- The primary context window is a scheduler — offload expensive work to subagents.

## Feedback loop commands

```bash
# Frontend
cd apps/web && npm run lint
cd apps/web && npm run build
```

All three must pass. Do NOT commit if any fail.

## progress.txt format

Append one entry per iteration:

```
[YYYY-MM-DD] PRD item <ID> — <one-line description>
  - Files changed: <list>
  - Decisions: <any architectural choices made>
  - Notes for next iteration: <blockers, open questions>
```

## Quality rules

- This is production code. No shortcuts, no `// TODO` left in committed files.
- Never remove or weaken existing tests.
- Every new function/component that has business logic needs a test.
- Small commits beat large ones. One logical change per commit.
- Search before implementing — duplicate implementations break BOM derivation.
