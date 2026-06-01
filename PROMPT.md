# Ralph Coding Agent Prompt

You are an autonomous coding agent working on the RackEditor project. Your job is to make incremental progress on the project migration described in `prd.json`.

## Getting Up to Speed

1. Run `pwd` to confirm your working directory
2. Read `progress.txt` to see what was accomplished in previous sessions
3. Run `git log --oneline -20` to review recent commits
4. Read `prd.json` to understand the full scope and current status of each task

## Your Task This Session

### 1. Choose ONE task

Pick one item from `prd.json` where `"passes": false`. Prioritize in this order:
- Core infrastructure that other tasks depend on (registry, routing layout)
- Integration points between modules (wiring components together)
- UI components that depend on infrastructure
- Redirects and polish after everything works

### 2. Search before implementing

Before writing any code, use subagents to search the codebase and confirm what is and isn't already implemented. **Do NOT assume something is missing without verifying.** Common failure mode: reimplementing something that already exists.

### 3. Implement the task

Make the changes needed so the task's `steps` criteria can be verified. Read `docs/migration_plan.md` for detailed implementation guidance, code examples, and design decisions.

### 4. Run feedback loops

After implementing, run linting before committing:

```bash
cd apps/web && npm run lint
```

Fix all errors. Do NOT commit broken code.

### 5. Commit your changes

```bash
git add -A && git commit -m "feat: <concise description of what you implemented>"
```

Use a descriptive commit message that references the feature. Keep it to one commit per PRD item.

### 6. Update progress.txt

Append a concise entry to `progress.txt`:
- Which PRD item you completed
- Key decisions made and why
- Files created or modified
- Any blockers or notes for the next session

Keep entries brief. Sacrifice grammar for concision.

### 7. Mark the task complete in prd.json

Set `"passes": true` for the item you completed. **Never remove or reorder items. Only change `passes` from `false` to `true`.**

### 8. Check for completion

If every item in `prd.json` has `"passes": true`, output exactly:

```
<promise>COMPLETE</promise>
```

---

## Rules

- **One task per session** — do not attempt multiple PRD items at once
- **Production quality** — this codebase will be maintained; no shortcuts, no hacks
- **Follow existing patterns** — read nearby files before writing new ones to match style and conventions
- **Never break what works** — run lint before committing; use `git revert` if something breaks
- **Small, focused changes** — one logical change per commit

---

## Project Context

This is a **Next.js 14 App Router** monorepo. The app lives in `apps/web/`. Path alias `@/*` maps to `apps/web/*`.

### Key Routing

All main workspace pages live inside the `(workspace)` route group:

- `apps/web/app/(workspace)/page.js` — current CAD editor (workspace root)
- `apps/web/app/(workspace)/quoter/page.js` — current Quoter
- New routes should be added inside `app/(workspace)/`

### Key Source Files

- `apps/web/src/apps/cad/CadWorkspacePage.js` — CAD workspace component
- `apps/web/src/apps/quoter/components/QuoterPage.js` — Quoter component
- `apps/web/src/shared/components/navigation/AppRailNav.js` — icon sidebar nav
- `apps/web/src/apps/cad/services/project/projectStorage.js` — localStorage I/O
- `apps/web/src/apps/cad/services/project/projectDocumentExporter.js` — project JSON serialize/restore

### Migration Goal

Replace the disconnected `/editor` + `/quoter` pages with a unified `/project/[id]` workspace that has tabs: **Design · Quote · 3D**. No backend required — everything uses `localStorage`.

New routing:
```
/projects                     → Project list / dashboard
/project/[id]/design          → CAD editor (tab 1)
/project/[id]/quote           → BOM Quoter (tab 2)
/project/[id]/3d              → 3D renderer (tab 3, placeholder)
```

Read `docs/migration_plan.md` for the complete implementation plan with code examples.
