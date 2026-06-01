---
description: Instructions for adding new tasks to prd.json following the project standard
---

# PRD Task Authoring

You are adding new tasks to `prd.json`. Follow these rules exactly.

## Task schema

Each task is a JSON object with these fields:

```json
{
  "id": "kebab-case-unique-id",
  "category": "infrastructure | feature | routing",
  "description": "One sentence: what the task accomplishes (not how).",
  "priority": 17,
  "steps": [
    "Acceptance criterion written in present tense, testable, references exact file paths."
  ],
  "passes": false
}
```

- `id`: kebab-case, globally unique across the file, descriptive of the outcome
- `category`: `infrastructure` (pure logic, no UI), `feature` (UI or behaviour change), `routing` (Next.js routes/layouts/redirects)
- `description`: one sentence, outcome-focused, no implementation details
- `priority`: integer, one higher than the current maximum in the file
- `steps`: array of acceptance criteria (see below)
- `passes`: always `false` for new tasks

## Writing steps

Each step is a **present-tense acceptance criterion** — a statement that is either true or false when inspected.

**Good:**
- `"apps/web/src/core/project/projectRegistry.js exports listProjects() returning an array of { id, name, createdAt, updatedAt }"`
- `"The active tab renders with background 'var(--accent, #3b82f6)', color '#ffffff', and borderRadius 6"`
- `"Navigating to /projects in the browser shows the projects list page"`

**Bad (imperative instructions — not steps):**
- `"Add a useEffect to QuoterPage"` ← tells ralph what to do, not what to verify
- `"Make the tab look like a pill"` ← vague, not testable

Rules for steps:
- Always include the exact file path for any file that must be created or modified
- Reference specific prop names, function names, CSS values, localStorage keys, or route paths when they matter
- If a step depends on a previous task passing, state it explicitly: `"Prerequisite: task <id> passes"`
- One criterion per step — do not combine multiple facts into one bullet

## Sizing rules

A task must be **small enough** that an LLM with a ~50k context window can complete it in a single pass, and **large enough** that the app is not broken between tasks.

### Sizing checklist

1. **Estimate lines to read**: sum the line counts of all files the task requires reading. If the total exceeds ~600 lines, split the task.
2. **One primary file per task**: prefer tasks that make all their changes in a single file. Tasks that touch two files are acceptable if both are small (<150 lines each). Three or more files is a signal to split.
3. **App must work after each task**: ask "if this task passes but the next one has not started, does the app still function?" If the answer is no, restructure the split.

### Safe split patterns

When a feature requires changes to both a large file A and a large file B:
- Task N: modify file A (add the new behaviour). App still works because file B's old code is harmless alongside the new behaviour.
- Task N+1: modify file B to remove/simplify the now-redundant code. Depends on task N.

Do **not** split a task so that half a feature lives in one file and the other half in another, leaving the app in a broken intermediate state.

## Before writing tasks

1. Read `prd.json` to find the current maximum priority.
2. Read `docs/migration_plan.md` for architectural context.
3. For each changed file, check its line count (`wc -l`). Files over 300 lines warrant extra care about splitting.
4. If the feature touches a component that already has a pending task against it, coordinate: either reference that task as a prerequisite or fold the changes in.

## Example: splitting a large task

**Too large (touches 1186-line QuoterPage.js AND 340-line CadWorkspacePage.js):**
```json
{
  "id": "auto-bom-sync",
  "steps": [
    "QuoterPage.js auto-syncs on mount",
    "CadWorkspacePage.js handleSendToQuoter navigates only"
  ]
}
```

**Correct split:**
```json
[
  {
    "id": "auto-bom-sync-on-quote-tab",
    "priority": 19,
    "steps": [
      "QuoterPage.js adds useEffect that calls loadCachedProjectDocument(projectId) on mount ...",
      "No changes are made to CadWorkspacePage.js in this task"
    ]
  },
  {
    "id": "remove-explicit-bom-sync-from-cad",
    "priority": 20,
    "steps": [
      "Prerequisite: task auto-bom-sync-on-quote-tab passes",
      "CadWorkspacePage.js handleSendToQuoter removes syncFromBom call and only calls router.push(...)"
    ]
  }
]
```
