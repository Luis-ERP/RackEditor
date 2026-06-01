# Plan: Project-centric Workspace (Option #2)
**Branch:** `agents-unifying-cad-editor-bom-interface`  

## The Core Problem
Right now the interface of the CAD editor and BOM quoter feels disconnected. The two tools speak different languages architecturally. CAD → Quoter requires a manual "submit" step that writes to localStorage, then a full page navigation to a peer app. The quoter feels like it receives from CAD rather than belongs with it.

## Solution

**Shared Tab Bar at the top of the workspace**
/editor and /quoter/[id] become /project/[id]/design and /project/[id]/quote. A two-tab strip at the top replaces the separate nav items. Switching tabs feels like flipping a page, not leaving an app. The rail nav shows one item: Project.
New routing: /projects (list) + /project/[id]/design | /quote | /3d (workspace tabs)

**Goal:** Replace the disconnected `/editor` + `/quoter` pages with a unified  
`/project/[id]` workspace that has tabs: **Design · Quote · 3D** (3D is a  
placeholder for now). No backend required — everything lives in `localStorage`.

## Key design decisions
- No backend needed — project IDs are client-side UUIDs; localStorage is the store. Backend sync can be bolted on later by swapping the storage layer.
- Zero logic migration — CadWorkspacePage and QuoterPage internals stay the same; they just get a projectId prop instead of hardcoded 'main'.
- The existing CAD cache mechanism already supports this — scopeKey in projectDocumentExporter.js maps directly to the project UUID.
- 3D tab is a placeholder — renders a "Coming Soon" card; the slot is reserved in the tab bar.

## Files to create (9 new files)
- src/core/project/projectRegistry.js + useProjectRegistry.js — CRUD for localStorage project list
- src/shared/components/common/ProjectWorkspaceTabs.js — tab strip (Design | Quote | 3D)
- app/project/[id]/layout.js + 3 tab pages (/design, /quote, /3d)
- app/projects/page.js + src/apps/projects/components/ProjectsListPage.js
- src/apps/three-d/components/ThreeDPlaceholderPage.js

## Files to modify (5)
CadWorkspacePage.js — scopeKey from prop, not 'main'
QuoterPage.js — project-scoped quote storage key
AppRailNav.js — swap CAD + Quoter items → single Projects item
app/editor/page.js + app/quoter/page.js → redirect to /projects

## Backward compat
Existing work in rack-editor:project:main auto-migrates to a "My First Project" entry
cadQuoteTransfer.js kept but deprecated — existing flows still work

---

## Mental Model

```
/projects                 → Project list / dashboard  
/project/[id]/design      → CAD editor (tab 1)  
/project/[id]/quote       → BOM Quoter (tab 2)  
/project/[id]/3d          → 3D renderer (tab 3, placeholder)
```

The project `[id]` is a client-side UUID stored in the browser. The existing  
`rack-editor:project:[scopeKey]` cache already supports arbitrary IDs — we just  
need to wire the URL `[id]` segment into it as the `scopeKey`.

### What stays the same
- `CadWorkspacePage` logic (unchanged internals)
- `QuoterPage` logic (unchanged internals)
- All stores (`useLayoutStore`, `useQuoteStore`, etc.)
- `projectDocumentExporter.js` cache mechanism — `scopeKey` = project UUID
- The `cadQuoteTransfer` localStorage bridge (deprecated later, kept for compat)

### What changes
- Routing: new `/project/[id]/*` tree; `/editor` + `/quoter` become redirects
- New shared `project/[id]/layout.js` renders the tab bar above the workspace
- `CadWorkspacePage` reads `scopeKey` from URL params instead of hardcoded `'main'`
- `QuoterPage` reads `quoteId` from a project-scoped localStorage key
- `AppRailNav` replaces the CAD + Quoter rail items with a single **Projects** item
- A new `/projects` list page lets users create and open projects

---

## New File Structure

```
app/
  projects/
    page.js                          ← Project list & "New project" CTA
  project/
    [id]/
      layout.js                      ← ProjectWorkspaceLayout (tab bar + children)
      design/
        page.js                      ← thin wrapper → <CadWorkspacePage projectId={id} />
      quote/
        page.js                      ← thin wrapper → <QuoterPage projectId={id} />
      3d/
        page.js                      ← <ThreeDPlaceholderPage />

src/
  core/
    project/
      projectRegistry.js             ← CRUD for the projects list in localStorage
      useProjectRegistry.js          ← React hook (subscribe pattern)
  shared/
    components/
      common/
        ProjectWorkspaceTabs.js      ← Tab bar component (Design | Quote | 3D)
  apps/
    three-d/
      components/
        ThreeDPlaceholderPage.js     ← Placeholder with "Coming soon" UI
```

---

## Implementation Steps

### Step 1 — Project Registry (pure logic, no UI)

**`src/core/project/projectRegistry.js`**

```js
// Schema: { id: string, name: string, createdAt: ISO, updatedAt: ISO }
const REGISTRY_KEY = 'rack-editor:projects-registry';

export function listProjects() { ... }        // → Project[]
export function createProject(name?) { ... }  // → Project (generates crypto.randomUUID())
export function updateProject(id, fields) { } // → Project
export function deleteProject(id) { }         // removes registry entry + cad cache key
```

**`src/core/project/useProjectRegistry.js`**  
React hook with `useState` + `storage` event listener so the list auto-updates  
when another tab creates a project.

---

### Step 2 — `/projects` List Page

**`app/projects/page.js`** → renders `ProjectsListPage`

- Shows a card/list of all projects from `useProjectRegistry`
- "New Project" button: `createProject()` → `router.push('/project/${id}/design')`
- Each project card: name, date, "Open" → `/project/[id]/design`
- Delete button with confirmation
- If no projects exist, show an empty state with a prominent CTA

---

### Step 3 — Project Workspace Layout + Tab Bar

**`src/shared/components/common/ProjectWorkspaceTabs.js`**

Props: `{ projectId, activePath, projectName }`  
Renders a horizontal strip of 3 tabs at the top of the workspace area (sits  
between `AppRailNav` and the page content). Uses `Link` to navigate between tabs.

```
[ Design ]  [ Quote ]  [ 3D ▸ soon ]
```

Visual language: tab strip with active underline accent — same design tokens as  
the existing `EditorPanel` view-mode selector but full-width.

**`app/project/[id]/layout.js`**

```jsx
import { ProjectWorkspaceLayout } from '@/src/shared/components/common/...';

export default function ProjectLayout({ children, params }) {
  return (
    <ProjectWorkspaceLayout projectId={params.id}>
      {children}
    </ProjectWorkspaceLayout>
  );
}
```

`ProjectWorkspaceLayout`:
- Reads project name from registry (or falls back to `"Project"`)
- Renders `<ProjectWorkspaceTabs>` at top
- Renders `{children}` filling the remaining height
- Sits *inside* the `AppWorkspaceLayout` so `AppRailNav` is still on the left

---

### Step 4 — Wire `CadWorkspacePage` to URL project ID

**`app/project/[id]/design/page.js`**

```jsx
export default function DesignPage({ params }) {
  return <CadWorkspacePage projectId={params.id} />;
}
```

**`CadWorkspacePage.js`** — add `projectId` prop, use it as `scopeKey` everywhere  
`'main'` was hardcoded:

```js
// Before
loadCachedProjectDocument('main')
cacheProjectDocument(doc, 'main')

// After
loadCachedProjectDocument(projectId)
cacheProjectDocument(doc, projectId)
```

Also: touch `updatedAt` on the project registry entry after each auto-save.

---

### Step 5 — Wire `QuoterPage` to project context

**`app/project/[id]/quote/page.js`**

```jsx
export default function QuotePage({ params }) {
  return <QuoterPage projectId={params.id} />;
}
```

**`QuoterPage.js`** — add `projectId` prop:
- Quote persistence key: `rack-editor:project:${projectId}:quote` (new; falls  
  back to old `cadQuoteTransfer` key on first load so existing data isn't lost)
- On mount: auto-consume any pending `cadQuoteTransfer` payload (backward compat)

---

### Step 6 — 3D Placeholder

**`src/apps/three-d/components/ThreeDPlaceholderPage.js`**

Simple centered card:
- 3D cube icon (or a Lucide `Box` icon)  
- "3D Renderer — Coming Soon"  
- Short description: "A three-dimensional view of your rack layout will appear here."

**`app/project/[id]/3d/page.js`** → renders `<ThreeDPlaceholderPage />`

---

### Step 7 — Update `AppRailNav`

- Replace `{ href: '/editor', label: 'CAD', Icon: DraftingCompass }` and  
  `{ href: '/quoter', label: 'Quoter', Icon: Calculator }` with a single:  
  `{ href: '/projects', label: 'Projects', Icon: FolderOpen }`
- Active state: highlight when `pathname.startsWith('/project')` OR  
  `pathname.startsWith('/projects')`

---

### Step 8 — Legacy Redirects

**`app/editor/page.js`** → redirect to `/projects`  
**`app/quoter/page.js`** → redirect to `/projects`  
**`app/quoter/[id]/page.js`** → keep alive (no change) — existing direct links  
still work. Mark with a `// @deprecated` comment pointing to new path.

Use Next.js `<Redirect>` or `notFound()` as appropriate; keep it simple.

---

### Step 9 — Default project for existing sessions

On app root `app/page.js` or `app/projects/page.js`:  
If no projects exist in the registry but the old `rack-editor:project:main`  
cache key IS present → auto-migrate: create a project with name `"My First  
Project"` using ID `"main"` so existing work is preserved.

---

## Data Flow After the Change

```
User opens /project/abc123/design
  └─ CadWorkspacePage loads cache "abc123"
  └─ Auto-saves to "abc123" on every change
  └─ updateProject("abc123", { updatedAt }) touches registry

User clicks "Quote" tab → /project/abc123/quote
  └─ QuoterPage loads quote from "rack-editor:project:abc123:quote"
  └─ On first open: checks for cadQuoteTransfer payload → migrates + clears it
  └─ BOM updates auto-save to "rack-editor:project:abc123:quote"

"Submit Design" button in CAD (future)
  → Instead of writing to cadQuoteTransfer + alert:
     write to "rack-editor:project:abc123:quote" directly + navigate to Quote tab
  (This can be done in a follow-up PR since cadQuoteTransfer still works for now)
```

---

## What We're NOT Doing (yet)

- Backend project model — UUID projects are localStorage-only; backend sync comes  
  later and will just persist the same JSON under a real project ID
- Removing `cadQuoteTransfer.js` — kept for backward compat, deprecated later
- Removing `app/quoter/[id]/page.js` — kept as a legacy route
- Any changes to the Quote → CAD back-linking
- The 3D renderer implementation — just the tab + placeholder

---

## Affected Files Summary

| Action | File |
|--------|------|
| CREATE | `app/projects/page.js` |
| CREATE | `app/project/[id]/layout.js` |
| CREATE | `app/project/[id]/design/page.js` |
| CREATE | `app/project/[id]/quote/page.js` |
| CREATE | `app/project/[id]/3d/page.js` |
| CREATE | `src/core/project/projectRegistry.js` |
| CREATE | `src/core/project/useProjectRegistry.js` |
| CREATE | `src/shared/components/common/ProjectWorkspaceTabs.js` |
| CREATE | `src/apps/three-d/components/ThreeDPlaceholderPage.js` |
| CREATE | `src/apps/projects/components/ProjectsListPage.js` |
| MODIFY | `src/apps/cad/CadWorkspacePage.js` — add `projectId` prop, remove hardcoded `'main'` |
| MODIFY | `src/apps/quoter/components/QuoterPage.js` — add `projectId` prop, project-scoped quote storage |
| MODIFY | `src/shared/components/navigation/AppRailNav.js` — swap CAD+Quoter for Projects |
| MODIFY | `app/editor/page.js` — redirect to /projects |
| MODIFY | `app/quoter/page.js` — redirect to /projects |
| DEPRECATE | `app/quoter/[id]/page.js` — keep but mark deprecated |
