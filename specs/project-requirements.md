# Project Requirements Specification

## 1) Scope Baseline

## 1.1 In Scope
- CAD-like 2D rack layout for selective pallet racking
- Embedded business-rule validation
- Deterministic BOM generation
- Pricing and quote management with revision traceability

## 1.2 Out of Scope (Initial Release)
- ERP/accounting/invoicing/procurement/inventory
- General-purpose CAD workflows
- Non-selective rack systems

---

## 2) Requirement Format

Each requirement includes:
- **ID**
- **Priority**: Must / Should / Could
- **Requirement**
- **Acceptance Criteria**

---

## 3) Functional Requirements

## 3.1 Project Setup and Workspace

### FR-001 (Must) Project metadata and units
The user can create a design project with customer/site metadata, units, precision, and scale defaults.

Acceptance Criteria:
- Project creation stores project/customer/site metadata.
- Unit system supports metric and imperial.
- Precision and default scale are persisted per project.

### FR-002 (Should) Drawing preferences
The user can configure grid, snap, and ortho preferences.

Acceptance Criteria:
- Grid on/off and spacing are user-editable.
- Snap on/off and tolerance are user-editable.
- Ortho mode can be toggled.

### FR-003 (Could) Multi-sheet support
The system supports multiple design sheets per project.

Acceptance Criteria:
- Users can create and switch sheets.
- Sheet state is persisted independently.

### FR-004 (Must) 2D navigation and selection
The workspace supports pan, zoom, fit-to-view, and selection workflows.

Acceptance Criteria:
- Pan/zoom works with mouse/trackpad.
- Fit-to-view and zoom-to-selection are available.
- Single and multi-select are supported.

### FR-005 (Must) Undo/redo
Undo/redo is available across design edits.

Acceptance Criteria:
- User can revert and re-apply recent edits.
- Operations include object create/edit/delete/move.

### FR-006 (Should) Layer controls
The user can manage layers and layer state.

Acceptance Criteria:
- Create/rename layers.
- Toggle visibility.
- Lock/unlock editing.
- Default layers include boundary/obstacles/racks/dimensions/annotations/reference.

---

## 3.2 Warehouse Context Modeling

### FR-010 (Must) Boundary and obstacle modeling
Users can create/edit boundary and obstacle entities.

Acceptance Criteria:
- Boundary supports polygon/rectangle.
- Obstacles support columns, walls, and no-rack zones.
- Obstacles can be moved/rotated/deleted.

### FR-011 (Must) Measurement tools
Users can measure distances and object dimensions.

Acceptance Criteria:
- Distance measurement works between points/objects.
- Linear dimensions are editable and persisted.

---

## 3.3 Rack Semantic Modeling

### FR-020 (Must) Rack run placement
Users can place rack runs by clicks or typed input.

Acceptance Criteria:
- Place by start/end clicks.
- Place by length + direction.
- Ghost preview is shown before commit.

### FR-021 (Must) Rack run parameters
Each run stores full semantic parameters.

Acceptance Criteria:
- Supports orientation/direction.
- Supports single and back-to-back configurations.
- Supports bay count or run length with computed counterpart.
- Stores frame spec (height/depth/gauge/capacity/weight).
- Stores beam spec (height/length/gauge/capacity/weight).
- Stores levels and beam elevations.

### FR-022 (Must) Elevation constraints
Beam elevations are constrained by policy.

Acceptance Criteria:
- Elevation increments limited to allowed step (2 in / 50 mm) or approved pattern.
- Elevations must fit within frame height.

### FR-023 (Must) Rack editing operations
Users can edit rack runs directly.

Acceptance Criteria:
- Move/rotate/mirror/duplicate supported.
- Stretching run reflows bays correctly.
- Changing specs propagates to BOM derivation inputs.

### FR-024 (Should) Bay-level overrides
Optional bay overrides are explicit and visible.

Acceptance Criteria:
- Bay override state is visually marked.
- Clear-overrides action exists.

### FR-025 (Should) Level/accessory behavior
Rack levels support accessories and level templates.

Acceptance Criteria:
- Beam pairs defined per level.
- Accessories can attach to bay/level where modeled.

### FR-026 (Must) Auto-numbering and labels
Rows and bays are auto-numbered with manual override support.

Acceptance Criteria:
- Configurable row scheme (alpha/numeric).
- Bay numbering generated per row.
- Manual label override persists.

---

## 3.4 CAD Interaction and Productivity

### FR-030 (Must) Snaps and ortho behavior
The editor supports object/grid snapping and ortho constraints.

Acceptance Criteria:
- Endpoint/midpoint/nearest and grid snap are available.
- Ortho lock supports 0/90 degrees.

### FR-031 (Should) Grips and in-place editing
Handles enable fast geometry edits and numeric entry.

Acceptance Criteria:
- Endpoint drag stretches.
- Body drag moves without reflow.
- Numeric values can be typed inline.

### FR-032 (Should) Duplicate/array/parallel workflows
Users can rapidly repeat placement and aligned layouts.

Acceptance Criteria:
- Duplicate and repeat-last-tool behavior are supported.
- Place-parallel/offset flow is supported.
- Row generator supports N runs with spacing S.

### FR-033 (Should) Multi-edit and swap commands
Bulk updates can be applied to selected runs.

Acceptance Criteria:
- Shared parameters can be edited in one action.
- Spec swap preserves geometry when valid.

### FR-034 (Should) Selection ergonomics
Selection supports filters, overlap cycling, and lasso add/remove.

Acceptance Criteria:
- Select-by-type filter available.
- Overlap candidate cycling available.
- Add/remove lasso behavior available.

### FR-035 (Could) Navigation accelerators
Support mini-map, saved views, and isolate mode.

Acceptance Criteria:
- Named views can be stored/restored.
- Temporary isolate mode available.

### FR-036 (Could) Import references
Users can import underlay/image/PDF or DXF references.

Acceptance Criteria:
- Imported references are non-semantic and lockable.

---

## 3.5 Validation and Rule Execution

### FR-040 (Must) Catalog-constrained configuration
Only valid catalog variants and combinations are selectable.

Acceptance Criteria:
- Incompatible options are hidden or blocked.
- Invalid capacity combinations are blocked or flagged.

### FR-041 (Must) Geometric validation
System validates collisions, aisle widths, and clearance constraints.

Acceptance Criteria:
- Detect rack vs obstacle and rack vs boundary conflicts.
- Enforce aisle minimums per configured policy.
- Enforce beam/frame coherence and alignment rules.

### FR-042 (Must) Validation output and traceability
Validation issues are inspectable and navigable.

Acceptance Criteria:
- Issue panel contains severity/message/object refs.
- Clicking issue zooms/selects offending objects.
- Validation runs on edit and on-demand.

### FR-043 (Should) In-flow validation UX
Validation feedback preserves drafting flow.

Acceptance Criteria:
- Soft warnings during drag.
- Blocking rules enforced on commit.
- Inline fix suggestions for common issues.

---

## 3.6 Design Persistence and Revisioning

### FR-050 (Must) Save and auto-save
Design state supports manual and continuous save.

Acceptance Criteria:
- Auto-save active for in-progress design work.
- Manual save action available.

### FR-051 (Must) Immutable design revisions
Users can create immutable design revisions with metadata.

Acceptance Criteria:
- Revision action creates new immutable snapshot.
- Metadata includes author/timestamp/notes.

### FR-052 (Must) Restore-as-new-head
Prior revisions can be restored only as a new revision.

Acceptance Criteria:
- Historical revision remains unchanged.
- Restore creates a new head revision.

### FR-053 (Should) Revision deep links
Specific design revisions can be linked/shared by ID.

Acceptance Criteria:
- Deep links open exact revision context.

---

## 3.7 Export Requirements

### FR-060 (Must) Design exports
Design revision exports include PDF, PNG, and DXF.

Acceptance Criteria:
- Export operation includes boundary, obstacles, racks.
- Labels and enabled dimensions are rendered.

---

## 3.8 BOM and Quoting Engine

### FR-070 (Must) Quote from design revision
Each quote revision references exactly one design revision.

Acceptance Criteria:
- Quote creation requires a design revision reference.
- Quote stores status and lifecycle metadata.

### FR-071 (Must) Deterministic BOM derivation
BOM is generated deterministically from the linked design revision.

Acceptance Criteria:
- Frames/beams/accessories derived by explicit rules.
- Derived quantities are reproducible.
- Each line includes source references and explanation.

### FR-072 (Must) BOM data fields
Each BOM line includes pricing and traceability fields.

Acceptance Criteria:
- Includes component identity, SKU/code, quantity, unit.
- Includes pricing fields (base, margin, retail, extended).
- Includes derivation explanation and source references.

### FR-073 (Must) Manual lines and derived-line adjustments
Manual additions and derived adjustments are supported with traceability.

Acceptance Criteria:
- Manual lines are visibly distinct from derived lines.
- Derived-line removals use soft-delete semantics.
- Quantity changes require reason/user/timestamp.

### FR-074 (Must) Override persistence policy
Override behavior is explicit and deterministic.

Acceptance Criteria:
- System uses one defined policy (adjustment-line or replacement).
- Regeneration respects policy without silent data loss.

### FR-075 (Must) Derived vs final BOM comparison
Users can compare baseline derivation with final commercial BOM.

Acceptance Criteria:
- Diff view shows added/removed/changed lines.

### FR-076 (Must) Versioned pricing integration
Pricing uses mapped rules and version context.

Acceptance Criteria:
- Quote revision stores pricing version/effective date.
- Each priced line identifies matched pricing rule.
- Missing prices are blocking before send.

### FR-077 (Must) Discounts and overrides
Quote-level and line-level adjustments are supported.

Acceptance Criteria:
- Supports percent and fixed amount.
- Discount and price override require reason + audit metadata.
- Role limits/attempt logging are supported at minimum.

### FR-078 (Must) Taxes, freight, labor
Commercial totals support taxes and service lines.

Acceptance Criteria:
- Taxes configurable by rate/amount and toggleable.
- Default tax rate supports 16% IVA policy.
- Freight/labor lines support pricing and discounts.
- Freight can derive from weight + city-based base table.

### FR-079 (Must) Quote outputs
Quote documents and exports are generated per revision.

Acceptance Criteria:
- PDF includes customer info, itemized lines, totals, revision metadata, and CAD snapshot.
- CSV/XLSX export is available.

### FR-080 (Must) Quote lifecycle and immutability
Quote statuses and transitions are governed by rules.

Acceptance Criteria:
- Draft to Sent requires no blocking issues.
- Sent revisions are immutable.
- Accepted/Rejected/Expired/Cancelled transitions are tracked.

---

## 3.9 CAD ↔ BOM ↔ Quote Connection

### FR-090 (Must) Referential integrity
Each quote revision references one immutable design revision.

Acceptance Criteria:
- Linked design revision metadata is visible in quote.
- Quote shows summary metrics from design (runs/bays/positions/capacity).

### FR-091 (Must) Change propagation
Design changes flow via new quote revisions.

Acceptance Criteria:
- Update-from-latest-design creates a new quote revision.
- Inconsistencies from overrides/deletions are detected and flagged.

### FR-092 (Must) Revision diffing
Users can compare revisions.

Acceptance Criteria:
- Quote revision diff covers BOM/pricing/discount changes.
- Design revision diff covers summary run/bay-level changes.

### FR-093 (Must) Unified rule execution
BOM derivation and validation share the same semantic model.

Acceptance Criteria:
- Blocking design issues are visible in quoter.
- Missing pricing blocks send.
- Error messages identify run/bay/level source.

### FR-094 (Should) Regeneration performance transparency
Regeneration is predictable and user-visible.

Acceptance Criteria:
- On-demand regenerate operation exists.
- Progress and failure messaging are provided.

---

## 3.10 Administrative and Configuration

### FR-100 (Must) Pricing mapping administration
Admins can import/manage pricing mappings with validation.

Acceptance Criteria:
- CRUD or import+validate flow available.

### FR-101 (Must) Validation policy configuration
Admins can configure validation parameters and severity policy.

Acceptance Criteria:
- Aisle mins/tolerances and warn-vs-error policies configurable.

### FR-102 (Should) Quote template management
Admins can select from versioned quote templates.

Acceptance Criteria:
- Template selection is stored per quote revision.

### FR-103 (Should) Audit reporting
Override/discount activity is reportable by user/date range.

Acceptance Criteria:
- Exportable report available.

---

## 3.11 Localization (English/Spanish)

### FR-110 (Must) Bilingual UI coverage
Core CAD, BOM, quote flows support EN/ES.

Acceptance Criteria:
- Navigation/actions/messages are translated.

### FR-111 (Must) Language preference and switching
User can switch language without workflow data loss.

Acceptance Criteria:
- Language preference persists by user/session.

### FR-112 (Must) Project and quote output language
Project/quote can store output language context.

Acceptance Criteria:
- Generated client-facing docs reflect selected language.

### FR-113 (Must) Localization fallback rules
Missing translations fallback to English and are logged.

Acceptance Criteria:
- Release gate checks translation completeness.

### FR-114 (Must) Locale-safe data display
Localized formatting does not alter exact engineering values.

Acceptance Criteria:
- SKU/code stays language-neutral.
- Numeric/units formatting is locale-aware but value-preserving.

### FR-115 (Should) Language auditability
Language used in generated outputs is attributable.

Acceptance Criteria:
- Output language is stored with document revision metadata.

---

## 4) Business Rules

### BR-001 Determinism
For a given design revision and rule set, BOM output is deterministic.

### BR-002 Immutability
Design revisions are immutable snapshots; sent quote revisions are immutable.

### BR-003 No silent drift
Commercial output may change only via explicit new revisions.

### BR-004 Pricing reproducibility
Quote revision must preserve pricing version context.

### BR-005 Override attribution
All quantity/price/discount overrides require who/when/why metadata.

### BR-006 Validation gate
Blocking design errors and missing prices prevent quote send.

### BR-007 Catalog authority
Only catalog-defined and compatible configurations are valid.

### BR-008 Traceability
Every BOM and quote line must trace back to source semantics or explicit manual entry.

### BR-009 Localization governance
Output language is part of revision context and audit trail.

### BR-010 Role-governed commercial controls
Discount/override actions respect role permissions and limits.

---

## 5) Non-Functional Requirements

### NFR-001 Predictable generation latency
BOM/pricing regeneration must be predictable for typical project size.

### NFR-002 Explainable failures
Errors must include actionable source context (run/bay/level).

### NFR-003 Auditability
All commercial-impacting actions are exportable and reviewable.

### NFR-004 Data consistency
Revision and cross-module references must maintain referential integrity.

---

## 6) Acceptance Criteria (System-Level)

### AC-001
Given a design revision, the system generates deterministic BOM and priced quote lines.

### AC-002
Given a sent quote revision, the system reproduces exact totals/document under later catalog changes.

### AC-003
Design changes require a new design revision and new quote revision for commercial updates.

### AC-004
All manual commercial adjustments are attributable and auditable.

### AC-005
English/Spanish localization is available in core workflows and generated outputs.