# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root (monorepo workspace wrapping `apps/web`):

```bash
npm run dev      # start Next.js dev server
npm run build    # production build
npm run lint     # ESLint via Next.js
```

To run against a backend, set `NEXT_PUBLIC_API_BASE_URL` in `apps/web/.env.local`; omitting it defaults to same-origin (Next.js API routes).

There is no test runner configured.

## Architecture Overview

Single Next.js 14 App Router app inside `apps/web/`. Path alias `@/*` maps to `apps/web/*`.

### Routing (`apps/web/app/`)

- `(workspace)/` — all main tools, wrapped by `AppWorkspaceLayout` which renders `AppRailNav` (icon sidebar) + content area
- `auth/login/` — login page
- `docs/` — documentation viewer (separate layout, no sidebar)

### Source layout (`apps/web/src/`)

```
src/
  apps/          # one directory per feature app (see below)
  core/          # shared infrastructure (API client, auth, catalog CSV data)
  shared/        # cross-app UI components, theme provider, navigation
```

### Feature apps (`src/apps/`)

| Directory | Purpose |
|---|---|
| `cad/` | Main CAD canvas — place/edit rack modules, walls, columns, notes |
| `quoter/` | Quote builder — syncs BOM from CAD, manages line items, exports PDF |
| `catalog/` | Product catalog browser |
| `tutorials/` | Interactive step-by-step labs overlaid on the CAD canvas |
| `quick-cad-bom/` | Mobile-friendly one-shot CAD+BOM tool |
| `chatbot/` | AI assistant |
| `crm/` | Client management |
| `hubspot/` | HubSpot integration |
| `docs/` | Documentation viewer component |

Each app follows the same internal layout: `components/`, `hooks/`, `services/`, `styles/`, `scripts/`.

### State management pattern

No Redux or Zustand. All stores are hand-rolled pub/sub singletons:

- Each store is created with a `create*Store()` factory that returns a plain object with `subscribe(listener)` → unsubscribe, plus domain methods.
- React components connect via `useSyncExternalStore`-based hooks (e.g. `useLayoutStore`, `useWallStore`).
- Module-level singleton instances live in `src/apps/cad/services/cadStores.js`. They persist across Next.js client-side navigations (CAD ↔ Quoter share the same store instances). SSR gets a fresh instance.

### CAD data model — two layers

**Layout layer** (`src/apps/cad/services/layout/`): positions every entity on the canvas.
- `layoutStore` — Map of entity id → entity; handles CRUD, selection, transform, lock, visibility
- Entity types: `RACK_MODULE`, `RACK_LINE`, `WALL`, `COLUMN`, `TEXT_NOTE`
- Coordinate system: 1 world unit = 1 metre (`coordinateSystem.js`); rendered on an HTML Canvas

**Rack domain layer** (`src/apps/cad/services/rack/`): business data for rack configurations.
- `rackDomainSingleton` — module-level `Map<domainId, rackModule>` written by `CADCanvas`, read by `EditorPanel` and `projectStore`
- Domain models: `frame`, `beam`, `bay`, `beamLevel`, `rackModule`, `rackLine`, `accessory`
- `rackFactory.js` — builds rack objects from configuration parameters
- `validation.js` — validates rack lines against all business rules, returns `ValidationState`
- `bomService.js` — deterministically derives BOM from a rack line (frames, beams, safety pins, anchors, spacers)
- `catalogRegistry.js` / `catalog.js` — resolves SKUs from CSV data in `src/core/rack/catalog_lists/`

### Project persistence

`src/apps/cad/services/project/`:
- `projectStorage.js` — pure localStorage I/O (schema version 2.0.0); keys prefixed `rack-editor:project:`
- `projectStore.js` — module-level singleton; subscribes to all CAD+Quote stores, debounces auto-save (500 ms), manages project CRUD
- `projectDocumentExporter.js` — serialize/restore full project state (layout + rack domain + canvas settings + quote) to/from JSON

### CAD→Quoter bridge

`src/apps/quoter/services/cadImportService.js` reads a project JSON, resolves catalog SKUs, and produces a BOM snapshot compatible with `quoteStore.withSyncedCadBom`. The pending import is passed via `sessionStorage` key `quoter:pendingCadImport`.

### Export formats

`src/apps/cad/services/export/`:
- `cadDrawingRenderer.js` — renders the canvas to an off-screen `<canvas>` Blob (used by all raster/vector exporters)
- `imageExporter.js` — PNG/JPEG download
- `pdfExporter.js` — PDF via jsPDF
- `svgExporter.js` — SVG
- `dxfExporter.js` — DXF

### Authentication

JWT stored in localStorage (`auth.accessToken`). `src/core/api/httpClient.js` (axios) injects the Bearer token on every request and clears it on 401.

### Files with " 2" suffix

Several files like `cadStores 2.js`, `noteStore 2.js` are stale duplicates left in the working tree. The canonical sources are the ones **without** the ` 2` suffix. Do not edit the ` 2` variants.
