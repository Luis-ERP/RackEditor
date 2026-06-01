# Frontend App Checklist

## Purpose

This document translates the functional requirements and business rules into an implementation checklist for the frontend team (Next.js app).

Use this as:
- Build checklist
- QA/UAT checklist
- Release readiness gate

Legend:
- [ ] Not started
- [x] Done
- **Must / Should / Could** priority tags are mandatory for planning

---

## 1) App Foundations

- [ ] **Must** Establish route map for core flows: Login, Projects, Design Workspace, BOM/Quote Workspace, Quote Revision Detail, Admin.
- [ ] **Must** Implement authenticated shell with role-aware navigation (Admin, Designer/Sales Engineer, Estimator, Viewer).
- [ ] **Must** Add global error boundary and recoverable API error UX.
- [ ] **Must** Add loading/skeleton states for all async screens.
- [ ] **Should** Add offline/network interruption handling with retry UX.

---

## 2) Authentication and Authorization UX

- [ ] **Must** Login form with clear validation and error messages.
- [ ] **Must** Session state bootstrapping (`/me`) and guarded routes.
- [ ] **Must** Role-based hiding/disabling of restricted actions:
  - Design edit
  - Revision creation
  - Discount application
  - Price override
  - Send quote
- [ ] **Must** Permission denial messages must be explicit and non-technical.

---

## 3) Project Setup UX

- [ ] **Must** Project create/edit form with required metadata: name, customer reference, site, notes.
- [ ] **Must** Unit system selector (metric/imperial), precision, and default scale.
- [ ] **Should** Drawing preference panel: grid, snap, snap tolerance, ortho.
- [ ] **Could** Multi-sheet support UI (sheet tabs + create/rename/delete if enabled in scope).

---

## 4) Design Workspace (CAD-like UI)

### 4.1 Navigation and Selection
- [ ] **Must** Pan/zoom controls (mouse + trackpad), fit-to-view, zoom-to-selection.
- [ ] **Must** Single select and multi-select (shift and box/lasso).
- [ ] **Must** Undo/redo controls with visible disabled states.
- [ ] **Should** Selection filter UI by object type.
- [ ] **Should** Cycle selection UI for overlapping objects.
- [ ] **Should** Lasso add/remove selection behavior.

### 4.2 Layer and Context Objects
- [ ] **Should** Layer manager (visibility + lock state).
- [ ] **Should** Layer create/rename controls and default layer set (boundary/obstacles/racks/dimensions/annotations/reference).
- [ ] **Must** Boundary creation/edit UI.
- [ ] **Must** Boundary shape options include rectangle and polygon.
- [ ] **Must** Obstacle creation/edit UI: columns, walls, no-rack zones.
- [ ] **Must** Move/rotate/delete controls for context objects.
- [ ] **Must** Measurement tool and dimension display toggle.
- [ ] **Must** Linear dimensions are editable and persisted.

### 4.3 Rack Run Placement
- [ ] **Must** “Place Rack Run” tool with two placement modes:
  - Start/end clicks
  - Typed length + direction
- [ ] **Must** Live ghost preview before commit.
- [ ] **Must** Inline quick controls during placement: bay count, bay width/length mode, orientation, B2B mode, levels.
- [ ] **Should** Repeat-last placement command (“place another like this”).
- [ ] **Should** Preset picker and favorites for common run configurations.

### 4.4 Rack Parameters Panel
- [ ] **Must** Parameter editor for run semantics:
  - Frame spec: height/depth/gauge/capacity/weight
  - Beam spec: length/height/gauge/capacity/weight
  - Levels and elevations
  - Row label
  - Single/B2B faces
- [ ] **Must** Bay count vs run length linked behavior (auto-compute counterpart).
- [ ] **Must** Elevation input constraints (2 in / 50 mm step or allowed pattern).
- [ ] **Must** Enforce beam elevation fit within frame height.
- [ ] **Must** Auto-number rows and bays with configurable row scheme (alpha/numeric) and manual label override persistence.
- [ ] **Should** Level templates and shift-all-levels actions.
- [ ] **Should** Bay-level override markers and clear-overrides action (if supported).
- [ ] **Should** Level/accessory semantics: beam pairs per level and accessory attach points by bay/level.

### 4.5 Direct Manipulation and Bulk Editing
- [ ] **Must** Move/rotate/mirror/duplicate/delete actions.
- [ ] **Must** Stretch endpoint behavior reflows bays.
- [ ] **Must** Body drag moves run without unintended reflow.
- [ ] **Must** Spec changes propagate correctly to BOM derivation inputs.
- [ ] **Should** Inline numeric edits for length/offset/rotation.
- [ ] **Should** Multi-select bulk edit for shared fields.
- [ ] **Should** Spec swap command preserving geometry when valid.

### 4.6 Productivity Tools
- [ ] **Should** Place parallel with offset from reference run.
- [ ] **Should** Row generator (`N` runs, spacing `S`, from point `P`).
- [ ] **Should** Aisle tool with width visualization.
- [ ] **Should** Snap-to-typical clearances configuration.
- [ ] **Could** Mini-map and saved views.
- [ ] **Could** Temporary isolate mode.
- [ ] **Could** Underlay/DXF reference import UX.
- [ ] **Could** Reference import supports underlay/image/PDF/DXF and lockable non-semantic references.

### 4.7 Snap and Constraint Controls
- [ ] **Must** Snap modes include endpoint, midpoint, nearest, and grid snap.
- [ ] **Must** Ortho lock supports 0/90 degrees.

---

## 5) Validation UX (Business Rules on Canvas)

- [ ] **Must** Real-time validation trigger on relevant edits.
- [ ] **Must** Manual “Validate Design” action.
- [ ] **Must** Issue list panel with:
  - Severity (warning/error)
  - Message
  - Linked object references
- [ ] **Must** Clicking issue focuses/selects related object(s).
- [ ] **Must** Canvas highlighting of violations (consistent error/warn visual language).
- [ ] **Must** Blocking rules prevent invalid commits where required.
- [ ] **Should** Soft warning feedback during drag/edit interactions.
- [ ] **Should** Inline fix suggestions for common failures.
- [ ] **Should** Configurable severity display according to team/project policy.

Validation cases frontend must expose clearly:
- [ ] **Must** Catalog incompatibility (frame/beam/accessory)
- [ ] **Must** Capacity incompatibility
- [ ] **Must** Rack-obstacle and rack-boundary collisions
- [ ] **Must** Beam/frame congruence (length/elevation/height rules)
- [ ] **Must** B2B alignment/elevation consistency
- [ ] **Must** Aisle minimum width violations
- [ ] **Should** Safety/clearance zone violations (if enabled)

---

## 6) Design Save, Revisions, and Exports

- [ ] **Must** Visible save status (saved/saving/error).
- [ ] **Must** Manual save + auto-save.
- [ ] **Must** “Create Design Revision” flow with revision notes.
- [ ] **Must** Revision timeline/list with author and timestamp.
- [ ] **Must** Restore historical revision as new head revision (never mutate old).
- [ ] **Should** Copy/share deep link to a specific design revision.
- [ ] **Must** Export actions for PDF, PNG, DXF by revision.
- [ ] **Must** Export settings include labels/dimensions toggles where supported.

---

## 7) BOM Workspace UX

- [ ] **Must** Create quote from selected design revision.
- [ ] **Must** Generate BOM from revision and show progress state.
- [ ] **Must** BOM table columns:
  - Component name/config
  - SKU/internal code
  - Quantity + unit
  - Pricing fields (base/margin/retail/extended)
  - Source references
  - Derivation explanation
- [ ] **Must** Drilldown interactions:
  - BOM line → highlight source run/bay/level in design
  - Design object → filter/select related BOM lines

### 7.1 Manual and Override Actions
- [ ] **Must** Add manual BOM line (visibly marked as manual).
- [ ] **Must** Soft-delete derived lines (not destructive delete).
- [ ] **Must** Quantity override flow requires reason code + note.
- [ ] **Must** Persist and display audit metadata (who/when/why).
- [ ] **Must** Baseline vs final BOM diff view.
- [ ] **Must** Regeneration behavior and override policy are explicit in UI copy.
- [ ] **Must** Use one defined override persistence policy (adjustment-line or replacement) and prevent silent data loss on regenerate.

---

## 8) Pricing and Commercial Controls UX

- [ ] **Must** Show pricing context (price list version/effective date) on quote revision.
- [ ] **Must** Show pricing rule match identifier per line (or details drawer).
- [ ] **Must** Handle missing prices with blocking banner + affected line indicators.
- [ ] **Must** Prevent “Send Quote” when blocking price gaps exist.

Discounts and overrides:
- [ ] **Must** Quote-level discount (percent/fixed amount).
- [ ] **Must** Line-level discount (percent/fixed amount).
- [ ] **Must** Unit price override with required reason metadata.
- [ ] **Must** Role-based limit handling (disable/block + explanatory message).
- [ ] **Should** Attempt logging feedback when user exceeds limit.

Totals section:
- [ ] **Must** Subtotal, discount total, net total.
- [ ] **Must** Tax toggle and configurable rate/amount (default 16% IVA).
- [ ] **Must** Freight and labor lines with description and amount.
- [ ] **Must** Freight and labor lines support discounts.
- [ ] **Should** Freight helper UI for weight × city-based base rate lookup.

---

## 9) Quote Revisions and Lifecycle UX

- [ ] **Must** Quote revision list with immutable history.
- [ ] **Must** Create new quote revision from same/newer design revision.
- [ ] **Must** Status transitions:
  - Draft → Sent (with blockers check)
  - Sent → Accepted/Rejected/Expired/Cancelled
- [ ] **Must** Once sent, revision becomes read-only in UI.
- [ ] **Must** Lifecycle metadata display: sent date/time, sender, recipients, acceptance timestamp.
- [ ] **Must** Revision-to-revision diff UI for BOM/pricing/discount changes.
- [ ] **Should** Warning panel when quote/design consistency issues are detected.

---

## 10) CAD ↔ Quote Consistency UX

- [ ] **Must** Quote header shows linked design revision metadata.
- [ ] **Must** Quote summary shows design metrics: runs, bays, positions, approximate capacity.
- [ ] **Must** “Update from latest design revision” action creates a new quote revision only.
- [ ] **Must** Inconsistency detector UI for overridden/deleted derived lines.
- [ ] **Must** Blocking/warning messaging references exact source objects where possible.
- [ ] **Should** Regeneration progress indicator with success/failure summary.
- [ ] **Should** Explicit on-demand regenerate action in quote workflow.
- [ ] **Must** Design revision diff UI covers summary run/bay-level changes.
- [ ] **Must** Surface unified-rule outcomes consistently between design validation and quote/BOM workflows.

---

## 11) Documents and Exports UX

- [ ] **Must** Generate quote PDF for current quote revision.
- [ ] **Must** PDF includes customer/project info, itemized categories, totals, revision metadata, and design snapshot.
- [ ] **Should** Quote package export (quote PDF + linked design export bundle).
- [ ] **Must** Export BOM/quote lines to CSV/XLSX.
- [ ] **Must** Export actions are revision-aware and non-destructive.

---

## 12) Admin Frontend Checklist

- [ ] **Must** Pricing mapping management UI (CRUD or import + validate).
- [ ] **Must** Validation policy settings UI (aisle mins, tolerance, warn/error policy).
- [ ] **Should** Quote template selector/version picker.
- [ ] **Should** Persist selected quote template/version per quote revision.
- [ ] **Should** Audit report screen with filters (user/date range/type) and export.

---

## 13) Localization (EN/ES) Checklist

- [ ] **Must** i18n framework integration for UI labels/actions/messages.
- [ ] **Must** Language switcher available without losing in-progress form/workflow state.
- [ ] **Must** User language preference persistence.
- [ ] **Must** Project/quote output language selector.
- [ ] **Must** Generated client-facing outputs reflect selected language.
- [ ] **Must** Missing translation fallback to English.
- [ ] **Should** Missing-key logging surfaced in developer diagnostics.
- [ ] **Must** Translation completeness checks included in release gate diagnostics.
- [ ] **Must** Locale-aware numeric/unit formatting while preserving exact engineering values.
- [ ] **Must** SKU/internal codes remain language-neutral across locales.
- [ ] **Must** Store language metadata for generated outputs for auditability.

---

## 14) API Contract and State Management Checklist

- [ ] **Must** Define typed DTOs for design entities, validation issues, BOM lines, quote revisions, pricing context.
- [ ] **Must** Normalize client state by entity IDs to preserve referential traceability.
- [ ] **Must** Implement optimistic/pessimistic strategy per action type (documented).
- [ ] **Must** Handle conflict responses gracefully (stale revision/version mismatch).
- [ ] **Must** Include revision IDs in all mutating requests.

---

## 15) Frontend QA Acceptance Checklist

### Determinism and Revision Integrity
- [ ] **Must** Re-opening same design revision yields same derived BOM content.
- [ ] **Must** Sent quote revision is read-only and reproducible.
- [ ] **Must** Design update cannot mutate existing quote revision silently.

### Validation and Blocking Rules
- [ ] **Must** Blocking design errors are visible in quote workflow.
- [ ] **Must** Missing price blocks send and identifies affected lines.
- [ ] **Must** Error messages include actionable source context.

### Audit and Attribution
- [ ] **Must** Quantity/price/discount overrides require and display attribution fields.
- [ ] **Must** Audit trails are visible on revision detail screens.

### Localization
- [ ] **Must** Core EN/ES workflows fully translated.
- [ ] **Must** Generated output language matches selected context.

---

## 16) Release Gate (Frontend)

All items below must be true before frontend release:

- [ ] **Must** No blocking TODOs remain in sections 1–13 for in-scope features.
- [ ] **Must** Draft-to-Sent quote flow passes with valid and invalid scenarios.
- [ ] **Must** Design revision and quote revision immutability verified in UI.
- [ ] **Must** BOM traceability drilldown works both directions.
- [ ] **Must** EN/ES smoke test completed.
- [ ] **Must** Export/PDF flows validated against revision context.