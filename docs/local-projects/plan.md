# Local-First Project System — Implementation Plan

## Problem Statement

The app currently has no concept of a "project" that spans both the CAD editor and the BOM quoter. Today:

- The CAD editor auto-saves a **single** layout to `localStorage` under a fixed key (`rack-editor:project:main`) and lets users manually export/import `.json` files.
- The Quoter has **no persistence at all** — state is in-memory only; users must manually download/load JSON on every visit.
- The two tools are loosely coupled through a one-way `sessionStorage` handoff: CAD → Quoter on-demand.

The goal is to ship a **local-first, account-free** experience where:

1. Users can create named projects, each containing a CAD layout + a linked quote.
2. All project data is stored in the browser's `localStorage` — no backend required.
3. Projects persist between browser sessions and survive page reloads.
4. Users can manage (create, rename, duplicate, delete) multiple projects from a project picker UI.
5. Projects can be exported to and imported from `.json` files for backup and sharing.

---

## What a "Project" Is

A project is a single JSON document that bundles:

| Field | Source | Notes |
|-------|--------|-------|
| `id` | `crypto.randomUUID()` | Stable identifier |
| `name` | User input | Display name |
| `createdAt` | Timestamp | ISO 8601 |
| `updatedAt` | Timestamp | Updated on every save |
| `schemaVersion` | `"2.0.0"` | For future migrations |
| `cad` | `layoutStore.snapshot()` + canvas state | Full CAD document (same shape as today's `projectDocumentExporter` output) |
| `quote` | `quoteStore.snapshot()` | Full quote (line items, tax rates, etc.) |

The `cad` field reuses the **exact existing schema** produced by `serializeProjectDocument()` in `projectDocumentExporter.js`. The `quote` field reuses the **exact existing schema** produced by `quoteStore.snapshot()`. Wrapping them in a project envelope is the only schema change.

---

## Storage Design

### Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `rack-editor:projects:index` | `string[]` of project IDs | Ordered list of all project IDs |
| `rack-editor:projects:active` | `string` (project ID) | Which project is currently open |
| `rack-editor:project:<id>` | Full project JSON | One key per project |

The index is a lightweight array so we can enumerate projects without reading every project blob. Each project lives under its own key so read/write are per-project (no full rewrite of all projects on save).

### Size Considerations

`localStorage` has a 5–10 MB limit per origin (browser-specific). A typical project (dozens of rack entities + quote) is well under 1 MB. Users with hundreds of projects may hit limits — the UI should surface storage usage and warn when approaching ~80% and limit when 95% or above reached.

---

## Module: `projectStorage.js`

**Location:** `apps/web/src/apps/cad/services/project/projectStorage.js`

Single-responsibility module for all localStorage I/O. No React, no store imports. Pure read/write functions.

```js
// All functions are synchronous; localStorage is synchronous by spec.

const PREFIX = 'rack-editor:project:';
const INDEX_KEY = 'rack-editor:projects:index';
const ACTIVE_KEY = 'rack-editor:projects:active';

listProjectIds()               // → string[]
readProjectMeta(id)            // → { id, name, createdAt, updatedAt } (reads only envelope, not body)
readProject(id)                // → full project object | null
writeProject(project)          // → void (writes + updates index + updates updatedAt)
deleteProject(id)              // → void (removes key + removes from index)
duplicateProject(id, newName)  // → new project object
getActiveProjectId()           // → string | null
setActiveProjectId(id)         // → void
clearActiveProjectId()         // → void
estimateStorageUsage()         // → { usedBytes, projects: [{ id, name, bytes }] }
exportProjectToFile(project)   // → triggers browser download of .json
importProjectFromFile(file)    // → Promise<project object> (reads + validates + writes)
```

**Note:** `readProjectMeta` reads only the top-level fields so the project picker can render a list without deserializing every full project blob.

---

## Module: `projectStore.js`

**Location:** `apps/web/src/apps/cad/services/project/projectStore.js`

Framework-agnostic store (same `subscribe/notify` pattern already used by `layoutStore` and `quoteStore`) that owns the **project registry state** (not individual project content — that stays in `layoutStore` and `quoteStore`).

```js
State:
  _projects: ProjectMeta[]   // List of all project summaries
  _activeId: string | null   // Currently open project ID
  _dirty: boolean            // Unsaved changes since last write
  _listeners: Function[]

Actions:
  createProject(name)        // Create new blank project, make it active
  openProject(id)            // Load project from storage into layoutStore + quoteStore
  saveActiveProject()        // Serialize both stores → writeProject()
  renameProject(id, name)    // Update name only (no full re-serialize)
  duplicateProject(id)       // Copy → new project with "(copy)" suffix
  deleteProject(id)          // Delete from storage; open most-recent if it was active
  refreshProjectList()       // Re-read index from localStorage
  setDirty()                 // Called by layoutStore/quoteStore on change
```

Auto-save is handled by the store: it subscribes to both `layoutStore` and `quoteStore` and debounces `saveActiveProject()` at 500 ms (slightly longer than today's 250 ms CAD-only debounce, to avoid double-writes when both change together on CAD import).

---

## Module: `useProjectStore.js`

**Location:** `apps/web/src/apps/cad/services/project/useProjectStore.js`

React hook wrapping `projectStore` with `useSyncExternalStore`, following the exact pattern of `useLayoutStore` and `useQuoteStore`.

```js
const { projects, activeId, dirty } = useProjectStore(store);
```

---

## Data Flow Changes

### Opening the App (First Visit)

```
App mounts
  └─ projectStore.init()
       ├─ no projects exist?
       │    └─ createProject("My First Project") → opens it
       └─ active project exists?
            └─ openProject(activeId) → loads into layoutStore + quoteStore
```

### CAD Editor Auto-Save

Remove the existing auto-save inside `projectDocumentExporter.js` (the 250 ms debounce to `rack-editor:project:main`). Replace with: `layoutStore` notifies `projectStore` on every change → `projectStore` debounces `saveActiveProject()`.

### Quoter Auto-Save

`quoteStore` notifies `projectStore` on every change → same debounce → same `saveActiveProject()` serializes both stores together.

### CAD → Quoter Handoff

The `sessionStorage` handoff (`quoter:pendingCadImport`) is **removed**. Both tools now share the same active project. When the user clicks "Send to Quoter":

1. CAD calls `quoteStore.syncFromBom(bom, options)` directly (both are in the same project context).
2. Navigation to `/quoter` happens — no data needs to be passed through session storage.
3. The Quoter reads from `quoteStore` which is already populated.

This is the biggest behavioral change: the two apps become **two views of the same project** rather than two independent tools.

---

## Project Picker UI

### Entry Point

On app load, before showing CAD or Quoter, show a **Project Picker modal/overlay** if no active project is set. If an active project exists, open it directly (no picker shown, same as today).

A "Projects" button in the `AppRailNav` (or a dedicated route `/projects`) opens the picker at any time without losing the current project.

### Project Picker Component

**Location:** `apps/web/src/shared/components/projects/ProjectPicker.js`

```
┌─────────────────────────────────────────────┐
│  My Projects                    [+ New]      │
│  ─────────────────────────────────────────  │
│  ● Warehouse A - Phase 1        [⋮]          │
│    Updated 2 hours ago                       │
│  ● Client XYZ Racking           [⋮]          │
│    Updated yesterday                         │
│  ● Draft Project                [⋮]          │
│    Updated 3 days ago                        │
│  ─────────────────────────────────────────  │
│  [Import from file]           Storage: 12%  │
└─────────────────────────────────────────────┘
```

Each row's `[⋮]` menu: Open, Rename, Duplicate, Export to file, Delete.

### Active Project Indicator

The top bar or rail nav should show the **current project name** + a dirty indicator (unsaved dot). Clicking the name opens the rename-in-place dialog. Clicking the "Projects" icon opens the picker.

---

## Migration from Current State

Users who have a project saved in the old `rack-editor:project:main` key need a migration path.

**Migration logic (runs once on first load after update):**

```
if localStorage has 'rack-editor:project:main'
  and localStorage does NOT have 'rack-editor:projects:index'
then:
  read old CAD document
  create new project:
    name: "Imported Project"
    cad: <old document>
    quote: empty quote (no old quote data exists)
  write to new project system
  delete old key 'rack-editor:project:main'
```

This runs in `projectStore.init()`. The migration is a one-time no-op after that.

---

## File Export / Import

### Export Format

Exported file is the full project JSON with an outer envelope:

```json
{
  "documentType": "rack-editor-project",
  "schemaVersion": "2.0.0",
  "exportedAt": "2026-05-29T00:00:00Z",
  "app": { "name": "RackEditor", "version": "web-v1" },
  "project": {
    "id": "...",
    "name": "Warehouse A",
    "createdAt": "...",
    "updatedAt": "...",
    "cad": { ... },
    "quote": { ... }
  }
}
```

The existing `downloadProjectDocument()` function in `projectDocumentExporter.js` is replaced by `projectStorage.exportProjectToFile(project)`.

### Import

`projectStorage.importProjectFromFile(file)` reads the file, validates `documentType` and `schemaVersion`, assigns a new `id` (so it doesn't clobber an existing project with the same id), sets the name, and writes it to storage. The user is then prompted to open it.

Schema migration: if `schemaVersion` is `"1.0.0"` (old CAD-only format), the importer wraps the document in the project envelope with an empty quote — same logic as the localStorage migration above.

---

## Implementation Steps

### Phase 1 — Storage Layer (no UI changes)

1. Create `projectStorage.js` with all read/write primitives.
2. Write unit tests for `projectStorage.js` (Node built-in runner, no DOM required — use a `localStorage` mock).
3. Create `projectStore.js` with create/open/save/rename/duplicate/delete actions and auto-save debounce.
4. Wire `projectStore` to `layoutStore` and `quoteStore`: both call `projectStore.setDirty()` after mutations.
5. Remove the existing 250 ms auto-save inside `projectDocumentExporter.js`.
6. Add `projectStore.init()` call in the root app/layout with migration logic.

**Deliverable:** Existing single-project behavior preserved but now going through the new storage layer. No visible UI change.

### Phase 2 — CAD ↔ Quoter Unification

7. Remove the `sessionStorage` handoff in `CadWorkspacePage.js` (send-to-quoter handler).
8. Update "Send to Quoter" to call `quoteStore.syncFromBom()` directly, then navigate to `/quoter`.
9. Update `QuoterPage.js` to remove `readPendingCadImportFromSession()` on mount.
10. Test round-trip: place racks in CAD → send to quoter → check line items → switch back to CAD → verify project state is intact.

**Deliverable:** The two tools share a project context. No sessionStorage handoff.

### Phase 3 — Project Picker UI

11. Create `ProjectPicker.js` component (list + create + actions menu + import).
12. Add "Projects" entry to `AppRailNav.js`.
13. Show project picker on first load (no active project) or on nav click.
14. Show current project name + dirty indicator in the shell.
15. Wire rename (inline), duplicate, delete, export-to-file, import-from-file.

**Deliverable:** Full project management UI.

### Phase 4 — Polish

16. Storage usage display in project picker footer.
17. Warn if localStorage write fails (quota exceeded).
18. Keyboard shortcut: `Cmd/Ctrl+S` → `saveActiveProject()` (today it does nothing or triggers browser save dialog).
19. "Unsaved changes" dialog if user navigates away or closes tab with `dirty=true`.
20. Project name in browser tab title.

---

## Files Touched

| File | Change |
|------|--------|
| `services/export/projectDocumentExporter.js` | Remove auto-save, keep `serializeProjectDocument()` as utility |
| `services/layout/layoutStore.js` | Add `setDirtyCallback` option so projectStore can subscribe |
| `services/project/projectStorage.js` | **New** |
| `services/project/projectStore.js` | **New** |
| `services/project/useProjectStore.js` | **New** |
| `apps/cad/CadWorkspacePage.js` | Remove sessionStorage send-to-quoter, call quoteStore directly |
| `apps/quoter/services/cadImportService.js` | Remove `readPendingCadImportFromSession()` or deprecate |
| `apps/quoter/components/QuoterPage.js` | Remove session import on mount |
| `shared/components/projects/ProjectPicker.js` | **New** |
| `shared/components/navigation/AppRailNav.js` | Add Projects entry + active project name |
| `shared/components/common/AppWorkspaceLayout.js` | Add project init call, dirty indicator |
| `app/layout.js` (or root page) | Call `projectStore.init()` on mount |

---

## What Does NOT Change

- The CAD entity model (`layoutStore`, entity types, transforms) — unchanged.
- The quote data model (`quoteStore`, line items, tax rates) — unchanged.
- The BOM derivation logic (`cadImportService.deriveBomFromCadProject`) — unchanged.
- The CSV catalog system — unchanged.
- The export formats (PNG, PDF, SVG, DXF) — unchanged (they already operate on the live store state).
- Auth stubs — not touched (this plan is explicitly account-free).

---

## Open Questions

1. **Cross-tab sync:** If the user opens the app in two tabs and edits both, the last write wins. `localStorage` `storage` events can be used to detect this and warn the user. Defer to Phase 4 or later.

2. **Project size limit UI:** Should we cap projects at some size and refuse to save? Or just warn? Recommend: warn at 80% total quota, hard-stop only on actual write failure.

3. **Quote versioning inside project:** `quoteStore` already has a 50-entry in-memory version history. Should named versions be persisted as part of the project? Recommend: yes — the `versioning` array in `quoteStore.snapshot()` is already included in the serialized quote, so this comes for free.

4. **Project templates:** Out of scope for this plan but the storage layer supports it trivially (a template is just a project with no client info).
