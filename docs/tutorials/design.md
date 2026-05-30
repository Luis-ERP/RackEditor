# Tutorial System — Design Document

This document captures the full reasoning chain behind the in-app tutorial and lab system for RackEditor: from user experience goals down to concrete technical decisions and file layout.

---

## 1. Starting from user behavior

The user population has three profiles:

- **First-timer**: needs orientation without reading docs.
- **Returner**: knows the basics, wants to complete one specific task.
- **Power user**: wants to reference internal rules quickly.

The curriculum is intentionally short. The tutorial system serves first-timers and returners. Power users read the internal docs.

From this we derive three non-negotiable UX requirements:

1. Tutorial must be **available without navigating away from the canvas**.
2. Lab steps must be **validated in real-time** against actual canvas state (not fake scaffolding).
3. Progress must **persist across sessions** so the user does not have to restart.

---

## 2. UX options evaluated

### Option A — Spotlight/tooltip tour (e.g., Shepherd.js)
- **Pro**: low friction, works without route changes
- **Con**: passive, no real validation of user actions, adds a third-party dependency

### Option B — Dedicated tutorial routes (`/tutorials/lab-1`)
- **Pro**: clean isolation, full canvas available, pre-seeded starter state
- **Con**: user leaves their work to do the lab

### Option C — Floating/sidebar tutorial panel alongside live canvas
- **Pro**: user works in their real canvas, validation is against real store state
- **Con**: panel competes for canvas real estate

### Option D — Bottom drawer (slide-up from footer)
- **Pro**: unobtrusive, familiar pattern (chat-style)
- **Con**: less visible, easy to ignore

### Decision: Hybrid B + C

- Use **Option C (sidebar panel)** when a tutorial is active on any page.
- Use **Option B (dedicated lab routes at `/tutorials/[labId]`)** for guided labs that start from a pre-seeded project.
- Use a lightweight built-in spotlight (inspired by Option A, but no library) for the onboarding orientation only.

The key insight: in Option B the lab route **renders the full CAD canvas** — the user is doing real work, just with a guided starting state. The panel overlays the canvas but the canvas is live.

---

## 3. UX wireframe (conceptual)

```
┌─────────────────────────────────────────────────────────┐
│  [NavBar]                                               │
├───────────────────────────────────┬─────────────────────┤
│  EditorPanel (left sidebar)       │  CAD Canvas         │
│                                   │                     │
│                                   │                     │
│                                   │                     │
│                                   │        [canvas]     │
│                                   │                     │
└───────────────────────────────────┴─────────────────────┘
                                   ↑
                   TutorialPanel (right overlay, collapsible)
                   ┌────────────────────────┐
                   │ Lab 1 · Step 2 of 3    │
                   │ ─────────────────────  │
                   │ Add a rack to the      │
                   │ canvas.                │
                   │                        │
                   │ ✓ Step validated       │
                   │ [Next Step →]          │
                   │ [Skip]  [Exit Lab]     │
                   └────────────────────────┘
```

The panel:
- is fixed-position, right edge, partially overlapping the canvas
- collapses to a small tab when the user wants full canvas
- shows step number, description, hint (expandable), and live checkpoint status
- auto-advances when a checkpoint passes (no button click needed)

---

## 4. Data model for a tutorial/lab

Each lab is a plain JS module:

```js
// src/apps/tutorials/labs/lab-1-first-rack.js
export default {
  id: 'lab-1-first-rack',
  title: 'Build Your First Rack',
  description: 'Place a rack module and configure two levels.',
  estimatedMinutes: 5,
  starterProject: null, // null = blank canvas, or a full project-document JSON object

  steps: [
    {
      id: 'step-add-rack',
      title: 'Add a rack module',
      description: 'Click the "Add Rack" button in the EditorPanel on the left.',
      hint: 'Look for the blue "+ Rack" button at the top of the left panel.',
      spotlight: 'button[data-tutorial="add-rack"]', // CSS selector for spotlight
      checkpoint({ layoutStore }) {
        return layoutStore.getAllByType('RACK_MODULE').length > 0;
      },
    },
    {
      id: 'step-add-levels',
      title: 'Add two levels',
      description: 'Open the rack editor and add at least 2 beam levels.',
      hint: 'Click the rack on the canvas to select it, then click "Edit" in the panel.',
      checkpoint({ rackDomainRef }) {
        const modules = [...rackDomainRef.current.values()];
        return modules.some((m) => (m.levelUnion?.levels?.length ?? 0) >= 2);
      },
    },
    {
      id: 'step-validate',
      title: 'Validate the rack',
      description: 'The rack should show green (VALID) status in the editor panel.',
      checkpoint({ layoutStore }) {
        const racks = layoutStore.getAllByType('RACK_MODULE');
        return racks.some((r) => r.validationState === 'VALID');
      },
    },
  ],
};
```

Key properties:

- `starterProject`: `null` for blank canvas, or a full project-document JSON to restore on lab load.
- `checkpoint(context)`: pure function receiving live store references, returns `boolean`. No mocking, no faking — real state.
- `spotlight`: CSS selector targeting a `data-tutorial="..."` attribute; when set, a spotlight overlay dims everything else.

---

## 5. Tutorial store (state layer)

Follows the identical subscribe/notify store pattern used by `layoutStore` and `quoteStore`:

```js
// src/apps/tutorials/tutorialStore.js
export function createTutorialStore() {
  let _activeLab = null;
  let _currentStepIndex = 0;
  let _completedLabs = new Set(loadCompletedLabsFromStorage());
  let _collapsed = false;
  const _listeners = [];

  function _notify() { for (const fn of _listeners) fn(); }

  function startLab(labDefinition) {
    _activeLab = labDefinition;
    _currentStepIndex = 0;
    _collapsed = false;
    _notify();
  }

  function advanceStep() {
    if (!_activeLab) return;
    if (_currentStepIndex < _activeLab.steps.length - 1) {
      _currentStepIndex++;
      _notify();
    } else {
      completeLab();
    }
  }

  function completeLab() {
    if (!_activeLab) return;
    _completedLabs.add(_activeLab.id);
    saveCompletedLabsToStorage([..._completedLabs]);
    _activeLab = null;
    _notify();
  }

  function exitLab() { _activeLab = null; _notify(); }
  function setCollapsed(v) { _collapsed = v; _notify(); }

  function getState() {
    return {
      activeLab: _activeLab,
      currentStepIndex: _currentStepIndex,
      currentStep: _activeLab?.steps[_currentStepIndex] ?? null,
      completedLabs: new Set(_completedLabs),
      collapsed: _collapsed,
      isActive: Boolean(_activeLab),
    };
  }

  return {
    subscribe: (fn) => {
      _listeners.push(fn);
      return () => { _listeners.splice(_listeners.indexOf(fn), 1); };
    },
    startLab, advanceStep, completeLab, exitLab, setCollapsed, getState,
  };
}
```

The store is exposed through a singleton (`src/apps/tutorials/tutorialSingleton.js`) — the same pattern as `quoteSingleton.js`.

---

## 6. React integration layer

```js
// src/apps/tutorials/hooks/useTutorialStore.js
import { useSyncExternalStore } from 'react';
import { getTutorialStore } from '../tutorialSingleton';

export default function useTutorialStore() {
  const store = getTutorialStore();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { store, state };
}
```

This mirrors `useLayoutStore` and `useQuoteStore` exactly — one hook, one singleton, zero prop drilling.

---

## 7. Checkpoint polling (subscription-based)

Lab checkpoints re-run whenever canvas state changes. The implementation subscribes to existing stores — no polling loop, no `setInterval`:

```js
// Inside TutorialPanel component
useEffect(() => {
  if (!state.currentStep?.checkpoint) return;

  const unsub = layoutStore.subscribe(() => {
    const passed = state.currentStep.checkpoint({ layoutStore, rackDomainRef });
    if (passed) tutorialStore.advanceStep();
  });

  return unsub;
}, [state.currentStepIndex, layoutStore, rackDomainRef, tutorialStore]);
```

This is pure subscription-based reactivity, consistent with how all stores in the app already work.

---

## 8. Spotlight mechanism

The spotlight overlay requires no external library. It uses a CSS `box-shadow` trick:

```js
// src/apps/tutorials/components/TutorialSpotlight.js
// position: fixed overlay with box-shadow: 0 0 0 9999px rgba(0,0,0,0.5)
// A transparent cutout is positioned over the target element.
// Uses ResizeObserver to track element movement after layout changes.
```

When `currentStep.spotlight` is set, `TutorialSpotlight`:
1. Queries the target element with `querySelector` + `getBoundingClientRect`
2. Renders a `position: fixed` overlay with the transparent cutout over the target
3. Re-measures on resize/scroll via `ResizeObserver`

Targets use `data-tutorial="..."` attributes rather than CSS class or tag selectors — this makes spotlight resilient to component refactors.

---

## 9. Routing for labs

New routes added to the Next.js App Router:

```
app/
  tutorials/
    page.js           ← Lab index: lists all labs with completion status
    [labId]/
      page.js         ← Lab runner: loads lab definition, restores starterProject,
                         renders CadWorkspacePage + TutorialPanel overlay
```

The `[labId]/page.js` pattern:

```js
// app/tutorials/[labId]/page.js
'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import CadWorkspacePage from '@/src/apps/cad/CadWorkspacePage';
import TutorialPanel from '@/src/apps/tutorials/components/TutorialPanel';
import { LAB_REGISTRY } from '@/src/apps/tutorials/labRegistry';
import { getTutorialStore } from '@/src/apps/tutorials/tutorialSingleton';
import { projectStore } from '@/src/apps/cad/services/project/projectStore';

export default function TutorialLabPage() {
  const { labId } = useParams();
  const lab = LAB_REGISTRY[labId];

  useEffect(() => {
    if (!lab) return;
    if (lab.starterProject) projectStore.openFromDocument(lab.starterProject);
    getTutorialStore().startLab(lab);
  }, [lab]);

  if (!lab) return <div>Lab not found.</div>;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <CadWorkspacePage />
      <TutorialPanel />
    </div>
  );
}
```

`CadWorkspacePage` renders exactly as it does on `/`. The tutorial is a pure overlay. No canvas logic is duplicated.

---

## 10. Lab registry

```js
// src/apps/tutorials/labRegistry.js
import lab1 from './labs/lab-1-first-rack.js';
import lab2 from './labs/lab-2-send-to-quoter.js';
import lab3 from './labs/lab-3-add-quote-line.js';

export const LAB_REGISTRY = {
  [lab1.id]: lab1,
  [lab2.id]: lab2,
  [lab3.id]: lab3,
};

export const LAB_LIST = [lab1, lab2, lab3];
```

Adding a new lab only requires creating a lab file and adding one import here.

---

## 11. Progress persistence

Tutorial completion state is stored in `localStorage` using the same safe-fail pattern as `projectDocumentExporter.js`:

```js
const STORAGE_KEY = 'rack-editor:tutorial-progress';

function loadCompletedLabsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCompletedLabsToStorage(ids) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); }
  catch { }
}
```

No backend required. Completion state persists across browser sessions.

---

## 12. Navigation integration

A "Tutorials" entry is added to `AppRailNav`:

```js
// In AppRailNav.js navItems array:
{ href: '/tutorials', label: 'Tutorials', Icon: BookOpen }
```

The tutorials index page (`/tutorials`) shows:
- Each lab as a card with title, description, and time estimate
- A completion badge when `completedLabs.has(lab.id)`
- A "Start Lab" button that navigates to `/tutorials/[labId]`

---

## 13. File system layout

All tutorial code lives in a new feature module, following the existing `src/apps/` convention:

```
src/apps/tutorials/
  tutorialStore.js          ← store factory (subscribe/notify)
  tutorialSingleton.js      ← module-scope singleton
  labRegistry.js            ← registry of all lab definitions
  hooks/
    useTutorialStore.js     ← React hook (useSyncExternalStore)
  components/
    TutorialPanel.js        ← floating step panel
    TutorialSpotlight.js    ← spotlight overlay
    LabCard.js              ← card used on the index page
  labs/
    lab-1-first-rack.js
    lab-2-send-to-quoter.js
    lab-3-add-quote-line.js
  styles/
    tutorial.css            ← panel + spotlight styles

app/tutorials/
  page.js                   ← lab index
  [labId]/
    page.js                 ← lab runner
```

---

## 14. Quoter labs (cross-page continuity)

For labs that span CAD → Quoter, the flow works because the tutorial store is module-scoped:

1. User is on `/tutorials/lab-2-send-to-quoter` (CAD route)
2. Checkpoint passes: at least one `RACK_MODULE` exists
3. Step instructs: "Click 'Send to Quoter'"
4. `handleSendToQuoter` fires, Next.js router pushes to `/quoter`
5. Tutorial store state persists (module-scope singleton survives route navigation)
6. `QuoterPage` renders `TutorialPanel` when `tutorialStore.getState().isActive`
7. Next steps validate `quoteStore` state (line_items, totals)

Context passes through the singleton — no prop drilling, no URL parameters.

---

## 15. What the tutorial system does NOT need

To keep the implementation lean and dependency-free:

- No external tour library (Shepherd.js, Intro.js, etc.)
- No server-side persistence (localStorage is sufficient)
- No video embeds (text + spotlight is enough)
- No animation framework beyond CSS transitions
- No separate CMS or backend for content (lab definitions are JS files)

The entire system lives within the existing tech stack.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| **Checkpoint brittleness** — checkpoints depend on store shape; shape changes break them | Internal-doc audit documents all store shapes explicitly; checkpoints are co-located with lab files so they are easy to find and update |
| **Lab starter projects** — if project schema version changes, embedded starter JSON needs migration | `isValidProjectDocument()` guard exists; lab files should use the latest schema and be updated on schema bumps |
| **Quoter cross-page continuity** — singleton survives navigation but not a hard refresh | Add `sessionStorage` fallback: serialize active lab ID + step index on every `_notify()`, restore on `getTutorialStore()` init |
| **Spotlight element targeting** — CSS class/tag selectors break when components are refactored | Use `data-tutorial="..."` attributes on all targeted elements; attribute-based selectors are refactor-resilient |
| **Panel real estate** — panel overlaps canvas, especially on smaller screens | Panel is collapsible to a tab; collapsed state is persisted per session |
