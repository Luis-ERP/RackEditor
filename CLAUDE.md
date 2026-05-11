# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from repo root and proxy into `apps/web/`:

```bash
npm run dev      # start Next.js dev server
npm run build    # production build
npm run lint     # ESLint
```

No test runner is configured at the workspace level. Tests live in `__tests__/` subdirs and use Node's built-in test runner or Jest (check individual test files before adding new ones). Run a single test file directly:

```bash
node apps/web/src/apps/cad/services/layout/__tests__/rackDomain.test.js
```

## Architecture

**Monorepo layout**: single workspace (`apps/web/`) using Next.js 14 App Router. No TypeScript — pure JS throughout.

**Internal path alias**: `@/` resolves to `apps/web/` (configured in Next.js).

### Layer structure inside `apps/web/src/`

```
src/
  core/           # cross-cutting singletons
    api/          # httpClient (axios + JWT interceptors), endpoints, authApi
    auth/         # tokenStorage (localStorage-based JWT)
    rack/         # CSV catalog data for frames/beams (imported as raw strings)
  shared/         # app-wide UI primitives
    components/   # AppWorkspaceLayout (shell), AppRailNav, common utils
    theme/        # AppThemeProvider — light/dark via CSS vars, stored in localStorage
  apps/           # feature modules; each follows components/hooks/scripts/services/styles
    cad/          # CAD canvas editor (main feature at `/`)
    quoter/       # quote builder at /quoter
    catalog/      # product catalog browser
    crm/          # client management
    chatbot/      # AI assistant
    hubspot/      # HubSpot integration
    quick-cad-bom # simplified BOM view
```

### State management pattern

Both CAD and Quoter use the same **framework-agnostic store + React hook** pattern:

1. **Store factory** (`createLayoutStore`, `createQuoteStore`) — plain JS class-like objects with `subscribe/notify`. Zero React dependency.
2. **React hook** (`useLayoutStore`, `useQuoteStore`) — wraps the store with `useSyncExternalStore`. One store instance per component tree via `useRef`.

Avoid importing stores directly into components; always go through the hook.

### CAD editor internals (`src/apps/cad/`)

- **`services/layout/layoutStore.js`** — entity map (racks, walls, notes, columns). CRUD + selection + snapshot/undo.
- **`services/rack/`** — rack domain: `catalog.js` (defaults), `catalogRegistry.js` (resolves specs from CSV), `rackFactory.js` (creates rack entities), `bomService.js` (BOM extraction), `pricingService.js`.
- **`services/export/`** — PNG/JPEG (`imageExporter`), PDF (`pdfExporter`), SVG (`svgExporter`), DXF (`dxfExporter`), combined project doc (`projectDocumentExporter`).
- **`components/cadCanvas/semantics.js`** — serializes the live store into the CAD project JSON format (`documentType: "rack-editor-project"`). This JSON is the interchange format between CAD and Quoter.

### Quoter internals (`src/apps/quoter/`)

- **`services/schemas/`** — pure functional transformers for quote data (immutable updates).
- **`services/quoteStore.js`** — wraps schemas with the subscribe/notify store pattern. Manages line items, tax rates, discounts, fees, versioning (50-step history), and CAD-BOM sync.
- **`services/cadImportService.js`** — parses CAD project JSON → BOM snapshot. Uses `CAD_IMPORT_SESSION_KEY` (`quoter:pendingCadImport`) in `sessionStorage` to hand off data from the CAD page to the quoter page.
- **`services/pdfQuoteGenerator.js`** — jsPDF-based quote PDF export.

### CSV catalog

`src/core/rack/catalog_lists/` contains `frames.csv` and `beams.csv`. Webpack is configured (`next.config.mjs`) to import `.csv` files as raw strings. `catalogData.js` parses them at module load time.

### Auth

`/api/auth/login` and `/api/auth/me` routes exist but return `501 NOT_IMPLEMENTED` — auth is not yet wired to a real backend. JWT is stored in `localStorage` and attached by the axios interceptor.

### Routing

Next.js App Router pages at `app/`:

| Route | Feature |
|-------|---------|
| `/` | CAD editor |
| `/quoter` | Quote builder |
| `/catalog` | Product catalog |
| `/clients` | CRM |
| `/chatbot` | AI assistant |
| `/hubspot` | HubSpot |
| `/quick-cad-bom` | Quick BOM view |
