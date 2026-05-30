# Tutorials and Internal Documentation Plan

## Goal

Create a documentation track that teaches new users how to use RackEditor from first contact to advanced quoting workflows, while also creating internal feature documentation that captures the app's business logic, domain rules, data flow, and operational constraints.

This plan intentionally treats **tutorials** and **internal docs** as two views of the same product knowledge:

- **Tutorials** explain how to use the app correctly.
- **Internal docs** explain why the app behaves that way and what rules drive the workflows.

If we separate those two too much, the tutorials will drift away from the business logic. The safer approach is to make the internal docs the canonical source and let tutorials reference them.

---

## Documentation Principles

1. **Business logic first**
   Every tutorial and feature doc must explain the domain rule behind the UI, not just button clicks.

2. **Simple to complex**
   New users should start with orientation and one happy-path workflow before seeing validation rules, BOM derivation, pricing, overrides, exports, and edge cases.

3. **Task-first teaching**
   Teach the app through real warehouse design and quoting jobs rather than by listing screens.

4. **Interactive by default**
   Every user-facing tutorial should be a guided lab with actions to perform in the app, expected results, rule checks, and a finished artifact.

5. **One canonical truth**
   Existing docs such as `business_rules_racks.md`, `model_schema.md`, `project_requirements.md`, and feature-specific implementation docs should be treated as source material for all new docs.

6. **Feature + rule pairing**
   Each feature page should include:
   - what the feature does
   - where it lives in the app
   - the business rules it enforces
   - its inputs and outputs
   - downstream effects on BOM, pricing, quote revisions, and exports

---

## Recommended Documentation Structure

```text
docs/
  tutorials/
    plan.md
    00-quick-start.md
    01-core-lab-layout-to-quote.md
    02-optional-lab-fixing-errors-and-overrides.md
    08-admin-and-support-playbook.md
    labs/
      lab-template.md
    internal/
      00-product-overview.md
      01-cad-feature-map.md
      02-rack-domain-business-logic.md
      03-validation-rules.md
      04-bom-derivation.md
      05-pricing-and-quote-logic.md
      06-cad-to-quoter-data-flow.md
      07-exports-and-document-generation.md
      08-catalog-and-spec-management.md
      09-auth-roles-and-route-behavior.md
      10-feature-inventory-by-module.md
```

---

## Best Tutorial Sequence for New Users

The best format is a **minimum viable curriculum**. Most users will only complete one meaningful walkthrough, so the curriculum should optimize for the shortest path to first success.

### Standard lab format
- **Scenario:** the warehouse/design/quote problem the user is solving
- **Starter state:** what already exists before the lab begins
- **Actions:** exact steps to perform in the app
- **Expected result:** what should appear on screen after each block
- **Business logic callout:** why the app behaves that way
- **Checkpoint:** one quick self-check before finishing
- **Completion artifact:** saved project, valid layout, BOM snapshot, quote revision, or export package

### 1. Quick start
**Purpose:** orient the user in a few minutes without making them commit to a full course.

**Teach:**
- CAD editor as the main design surface
- Quoter as the commercial workspace
- Catalog as the source of allowed rack components
- Why the app is not general CAD: it is a rack-domain tool with rule-driven outputs

**Key business logic to introduce:**
- The drawing is not the source of truth; semantic rack configuration is.
- Geometry, BOM, and pricing are derived from catalog-backed configuration.

### 2. Core lab: layout to quote
**Purpose:** give users one end-to-end win that proves how the product works.

**Teach:**
- create/open project
- workspace navigation
- place one rack run
- set frame and beam specs
- define beam levels
- save/export basic output

**Key business logic to introduce:**
- catalog-constrained selections
- beam levels align to allowed hole spacing
- rack parameters affect BOM and later quote output

### 3. Optional follow-up lab: fix and refine
**Purpose:** teach the most common second-step behavior only if the user needs it.

**Teach:**
- validation panel
- common errors
- one edit to the rack run
- one validation failure and fix
- one controlled override or refinement

**Key business logic to introduce:**
- invalid catalog combinations
- incomplete vs invalid states
- change propagation from semantics to BOM/quote behavior
- overrides must stay explicit and auditable

---

## Simplified Curriculum Ideas

### Required
- **Quick Start** — understand the product model in a few minutes.
- **Core Lab: Layout to Quote** — complete one valid rack project from design to quote output.

### Optional
- **Fix and Refine Lab** — learn validation, correction, and one override path.

### Internal-only advanced training
- back-to-back layouts
- bay-level overrides
- deep BOM/pricing traceability
- export differences and troubleshooting

---

## Interactive Lab Design Ideas

### 1. Scenario-based labs
Each lab starts from a realistic customer/design request such as:
- build a single selective rack line for a small aisle
- revise an existing layout after a validation failure
- convert a finished design into a quote-ready BOM

This keeps the tutorial tied to business outcomes instead of isolated clicks.

### 2. Starter files and expected end states
Where possible, each lab should include:
- a starter project file
- the target completed state
- screenshots or reference outputs
- a short list of validation conditions the user should satisfy

This makes the tutorial self-checking.

### 3. Intentional mistake labs
Some of the best learning will come from guided failure:
- choose an invalid beam/frame combination
- set an elevation that violates the hole grid
- create a bay with incomplete levels
- produce a quote scenario with missing or overridden pricing

These labs teach the business logic much better than happy-path-only content.

### 4. Single-checkpoint completion
Each user lab should have only one meaningful checkpoint near the end.

This reduces drop-off and keeps the flow finishable.

### 5. Dual-track callouts
Each lab should include two small sidebars:
- **User takeaway:** what the operator needs to do
- **Internal logic:** what rule or derivation the system is applying

That gives us one asset that helps both onboarding and internal training.

---

## Internal Documentation We Should Create

### 1. Product and architecture overview
Document the route map, module responsibilities, and the relationship between:
- CAD
- Quoter
- Catalog
- CRM
- Chatbot
- HubSpot
- Quick CAD BOM

### 2. Rack domain business logic
This should be one of the most detailed docs and must consolidate the rules spread across current docs and code:
- rack line structure
- frame, bay, beam, and beam-level concepts
- hole spacing / elevation rules
- frame depth uniformity
- beam spec compatibility
- valid vs incomplete vs invalid states
- back-to-back row behavior
- accessory attachment rules
- derived vs stored values

### 3. Validation rule reference
A searchable internal guide for:
- what each validation checks
- whether it blocks or warns
- what user action typically causes it
- what fix is expected
- which downstream systems are affected if ignored

### 4. BOM derivation logic
Explain:
- what semantic inputs are used
- how frame count and bay composition are derived
- how levels contribute components
- how accessories enter BOMs
- how source references trace back to design entities

### 5. Pricing and quoting logic
Explain:
- price inputs and price-list assumptions
- line pricing vs quote-level adjustments
- tax defaults
- freight and labor handling
- quote revision immutability
- override audit requirements

### 6. CAD ↔ Quoter handoff
Document:
- the CAD project JSON shape
- semantic serialization
- session handoff behavior
- import rules
- what happens when design semantics are missing or invalid

### 7. Export and document generation
Document:
- PNG/JPEG export behavior
- PDF export behavior
- SVG and DXF export
- project document export
- when each format is presentation-only vs semantic

### 8. Catalog and spec management
Document:
- CSV catalog sources
- how specs are loaded and resolved
- what fields are authoritative
- how invalid combinations are detected

### 9. Feature inventory by module
Create one internal page per module with:
- purpose
- user roles
- main screens
- important services/hooks/stores
- related business rules
- known gaps or current limitations

### 10. Lab support docs
Create internal support pages for the tutorial system itself:
- lab inventory and intended audience
- starter assets and expected outcomes
- prerequisite matrix
- rule coverage map showing which labs teach which business rules
- maintenance notes for keeping labs aligned with product changes

---

## Business Logic Coverage Checklist

The new docs set must explicitly cover these areas:

### Rack domain
- Rack lines are continuous bay sequences.
- Frame count is derived from bay count (`N` bays = `N + 1` frames).
- Frame depth must be uniform within a line or within each row of a back-to-back setup.
- Frame height may vary by position if the domain supports it.
- Bay width must match a valid catalog beam length.
- A bay with no levels is incomplete.
- Level indices are ordered, consecutive, and start at zero.
- Beam elevations align to the hole grid.
- Connector envelope and beam profile height matter for clearance logic.

### Modeling and semantics
- The canvas is a projection; semantic configuration is authoritative.
- Derived values should be computed, not treated as independent truth.
- Module boundaries are editing zones, not domain ownership containers.
- Customization should be understood structurally, not only as UI flags.

### Validation
- Catalog incompatibility
- Capacity incompatibility
- boundary/obstacle collisions
- aisle minimums
- beam/frame coherence
- back-to-back consistency
- incomplete vs invalid state handling

### BOM and pricing
- BOM is derived from semantic rack data.
- Source traceability from design object to BOM line must be explained.
- Manual overrides must remain visible and auditable.
- Pricing gaps are blocking conditions.
- Taxes, labor, freight, discounts, and overrides must be clearly defined.

### Revisions and persistence
- design save vs design revision
- quote revision immutability
- regeneration behavior
- change traceability between revisions

### Integration and exports
- CAD project JSON as interchange format
- Quoter import behavior
- semantic vs presentation exports
- route-level feature boundaries across app modules

---

## Proposed Execution Order

1. **Create the canonical internal docs first**
   Start with rack-domain business logic, validation, BOM, pricing, and CAD-to-Quoter flow.

2. **Build tutorials on top of those docs**
   Each tutorial should link to the internal rule pages it depends on.

3. **Add role-based/internal operational docs**
   Admin/support/sales-engineering docs should come after the product logic is documented.

4. **Add maintenance ownership**
   Each page should identify the code area or source docs it depends on so future updates are easier.

5. **Package tutorials as a tiny curriculum**
   Keep the user track to one quick read and one core lab, with one optional follow-up lab only.

---

## Suggested First Deliverables

- `docs/tutorials/00-quick-start.md`
- `docs/tutorials/01-core-lab-layout-to-quote.md`
- `docs/tutorials/02-optional-lab-fixing-errors-and-overrides.md`
- `docs/tutorials/labs/lab-template.md`
- `docs/tutorials/internal/02-rack-domain-business-logic.md`
- `docs/tutorials/internal/03-validation-rules.md`
- `docs/tutorials/internal/04-bom-derivation.md`
- `docs/tutorials/internal/05-pricing-and-quote-logic.md`

These eight docs would give us:
- one very short onboarding entry point
- one core interactive lab most users can finish
- one optional follow-up lab for error recovery
- one reusable lab authoring template
- the minimum internal canon for business logic
- a stable base for internal advanced training

---

## Notes

- Existing docs already contain strong source material, especially around rack rules, model design, and functional requirements.
- The highest-risk failure for future docs is creating too many tutorials that users never finish, or UI-only instructions that ignore the semantic model.
- Internal docs should not just describe screens; they should describe **state, derivation, constraints, and side effects**.
- The public user curriculum should stay tiny; deeper material should live in internal docs or optional advanced training.

---

## Appendix — Expanded Internal Docs Coverage From Source Audit

This appendix expands the internal-doc coverage list based on implemented code behavior, not just the existing design docs. The internal docs should treat the following files as primary sources:

- `apps/web/src/apps/cad/services/rack/constants.js`
- `apps/web/src/apps/cad/services/rack/models/*.js`
- `apps/web/src/apps/cad/services/rack/rackFactory.js`
- `apps/web/src/apps/cad/services/rack/validation.js`
- `apps/web/src/apps/cad/services/rack/bomService.js`
- `apps/web/src/apps/cad/services/rack/pricingService.js`
- `apps/web/src/apps/cad/services/rack/rowSpacerRules.js`
- `apps/web/src/apps/cad/services/rack/catalogRegistry.js`
- `apps/web/src/core/rack/catalog_lists/catalogData.js`
- `apps/web/src/apps/cad/services/layout/layoutStore.js`
- `apps/web/src/apps/cad/services/export/projectDocumentExporter.js`
- `apps/web/src/apps/quoter/services/cadImportService.js`
- `apps/web/src/apps/quoter/services/quoteStore.js`
- `apps/web/src/apps/quoter/services/schemas/common.js`
- `apps/web/src/apps/quoter/services/schemas/quoteSchema.js`
- `apps/web/src/apps/quoter/services/schemas/quoteLineItemSchema.js`
- `apps/web/src/apps/cad/services/rack/__tests__/rackDomain.test.js`

### 1. CAD editor core store and entity behavior

Internal docs should explicitly document these layout-store rules (`apps/web/src/apps/cad/services/layout/layoutStore.js`):

- The layout store is the authoritative canvas-entity store; rendering is downstream of store state.
- Every entity must have `id` and `type` to be added.
- Duplicate entity IDs are rejected.
- Removing an entity also clears it from selection.
- `removeSelected()` deletes all selected entities and clears selection in one operation.
- `duplicateSelected()` deep-clones selected entities, gives each a fresh ID via `nextEntityId`, offsets them by `(1, 1)` world units, and replaces selection with the clones.
- Locked entities cannot be moved or rotated by `moveTo`, `moveBy`, `moveSelectedBy`, `setRotation`, or `rotateBy`.
- Rotation is normalized to `0–359` degrees.
- `update()` forbids patching `id`, `type`, and `transform`; transform changes must use dedicated APIs.
- Rect selection ignores invisible entities.
- Hit-testing walks entities in reverse insertion order, so last-added visible entities win.
- `snapshot()` exports serializable entity copies; `restore()` replaces the full store and clears selection.

Internal docs should also explain the UX implications:

- Selection is a first-class store concept, not only a UI state.
- Visibility and locking are persisted at entity level.
- Several mutations are in-place store mutations followed by notify, not immutable replacements.

### 2. Rack-domain constants and enums

Internal docs should have a canonical reference page for domain constants (`apps/web/src/apps/cad/services/rack/constants.js`):

- `HOLE_STEP_IN = 2`
- `MIN_BAY_COUNT = 1`
- `SAFETY_PINS_PER_BEAM = 2`
- `BEAMS_PER_LEVEL = 2`
- `ValidationState = INCOMPLETE | VALID | VALID_WITH_WARNINGS | INVALID`
- `RowConfiguration = SINGLE | BACK_TO_BACK_2 | BACK_TO_BACK_3 | BACK_TO_BACK_4`
- `LevelMode = UNIFORM | VARIABLE`
- `AccessoryScope = RACK_LINE | BAY | LEVEL`
- `AccessoryCategory = DERIVED | EXPLICIT`
- `BasePlateType = STANDARD | HEAVY_DUTY`
- `ANCHORS_PER_FRAME`: STANDARD=`2`, HEAVY_DUTY=`4`
- `CAPACITY_CLASS_RANK`: LIGHT=`0`, STANDARD=`1`, MEDIUM=`2`, HEAVY=`3`, EXTRA_HEAVY=`4`

This page should explain which constants are:

- physically meaningful domain rules
- editor defaults
- BOM multipliers
- validation-state outputs

### 3. Frame model rules

Internal docs should document all frame invariants from `models/frame.js`:

- `FrameSpec.heightIn` and `depthIn` must be positive.
- `compatibleConnectorTypes` must be a non-empty array.
- `minimumTopClearanceIn` must be present and non-negative.
- `basePlateType` defaults to `STANDARD`.
- `createFrame()` requires `positionIndex` to be a non-negative integer.
- `rowIndex` on a frame may be `null` or a non-negative integer.
- Hole conversion rules are implemented by `holeIndexToElevation()` and `elevationToHoleIndex()`.
- Non-grid elevations return `null` from `elevationToHoleIndex()`.
- `frameCountFromBays(bayCount)` enforces `bayCount >= 1` and returns `bayCount + 1`.
- `frameHoleCount()` and `maxHoleIndex()` both derive from `heightIn / HOLE_STEP_IN`.

Internal docs should call out a modeling nuance:

- The implementation still stores `isCustomSpec` on frames even though `docs/model_schema.md` argues customization should be derived rather than stored.

### 4. Beam and beam-level rules

Internal docs should document these rules from `models/beam.js`:

- `BeamSpec.lengthIn` must be positive.
- `verticalEnvelopeIn` must be non-negative.
- `profileHeightIn` must be non-negative and present.
- `compatibleUprightSeries` must be a non-empty array.
- `createBeamLevel()` requires non-negative integer `holeIndex` and `levelIndex`.
- `elevationIn` is stored as `holeIndex * HOLE_STEP_IN`.
- `minimumGapSteps(lowerBeamSpec, upperBeamSpec)` uses:
  - hole step
  - max of lower/upper connector envelopes
  - lower beam profile height
- If one adjacent beam spec is missing, spacing logic falls back to the other spec.
- If both adjacent specs are missing, spacing falls back to a one-hole minimum.
- `validateLevelSpacing()` enforces both:
  - strictly increasing `holeIndex`
  - minimum gap between adjacent levels
- `isBeamCompatibleWithFrame()` checks upright-series compatibility only; connector-type checks happen elsewhere.
- `withBeamLevelSpec()` marks a level as explicitly customized with `isBeamSpecCustomized = true`.

Internal docs should separately describe:

- connector envelope below beam seat
- beam profile height above beam seat
- why lower-beam profile height affects upper-level spacing

### 5. Bay rules

Internal docs should document these bay-level constraints from `models/bay.js`:

- `leftFrameIndex` must be a non-negative integer.
- `rightFrameIndex` is always derived as `leftFrameIndex + 1`.
- A bay stores both `beamSpec` and `levels`, and validation checks whether level beam lengths match the bay beam length.
- `validateBayBeamLength()` compares each level’s `beamSpec.lengthIn` to `bay.beamSpec.lengthIn`.
- `bayBeamCount()` returns `levels.length * 2`.
- `withBayBeamSpec()` changes only the bay-level beam spec and marks `isBeamSpecCustomized = true`; it does **not** rewrite per-level beam specs.

Internal docs should flag a model-risk area:

- `docs/model_schema.md` calls top-level bay `beamSpec` redundant, but the current implementation still stores and uses it.

### 6. Rack-module rules

Internal docs should document the module structure from `models/rackModule.js`:

- A module must contain at least one bay.
- Bays inside a module must be consecutive:
  - `bay[i].leftFrameIndex === bay[i-1].rightFrameIndex`
- `frameCount = bays.length + 1`
- `endFrameIndex = startFrameIndex + bays.length`
- `frameOverrides` keys must be integers within `[0, frameCount - 1]`
- `levelUnion` is the module-wide shared beam-level config.
- `rowIndex` is nullable, but required by validation for back-to-back lines.
- `resolveFrameSpecAtIndex()` applies per-frame override fallback to `frameSpec`.
- `withFrameOverride()` can set or clear an override immutably.

Internal docs should explicitly explain the current ownership model:

- The code still treats modules as owners of:
  - `frameSpec`
  - `frameOverrides`
  - `levelUnion`
- This differs from the normalized ownership proposed in `docs/model_schema.md`.

### 7. Rack-line rules

Internal docs should document the line-level invariants in `models/rackLine.js`:

- A rack line must contain at least one module.
- `rowConfiguration` must be one of the supported enum values.
- Any non-single row configuration requires `backToBackConfig`.
- Consecutive modules must share a frame:
  - `modules[i].startFrameIndex === modules[i-1].endFrameIndex`
- `totalBayCount` is the sum of module bay counts.
- `totalFrameCount` counts the first module fully and subsequent modules as `frameCount - 1` because of shared frames.
- `validationState` initializes as `INCOMPLETE`.
- `rackLineFrameIndices()` de-duplicates shared frames.
- `rackLineAllBays()` flattens module bays.
- `rackLineRowCount()` derives row count strictly from `rowConfiguration`.
- `withValidationState()` only accepts known validation states.

Internal docs should call out another doc/code gap:

- The implementation still stores `levelMode`, `totalBayCount`, `totalFrameCount`, and `validationState`, while `docs/model_schema.md` argues these should be derived or query-layer values.

### 8. Rack factory and generated-structure behavior

Internal docs should document builder logic in `rackFactory.js`:

- `buildBeamLevels()` sorts hole indices and assigns sequential `levelIndex` based on sorted order.
- `buildRackModule()` rejects `bayCount < MIN_BAY_COUNT`.
- `buildRackModule()` checks beam/upright compatibility before constructing the module.
- All bays in a module share the same `levelUnion` reference at build time.
- `buildRackLine()` assigns consecutive `startFrameIndex` values so later modules share the ending frame of the previous module.
- `buildRackLine()` auto-validates and stamps the returned line with the validation state.
- `buildSimpleRackLine()` always uses `LevelMode.UNIFORM`.
- `buildMultiModuleRackLine()` always uses `LevelMode.VARIABLE`.
- `generateFrames()` de-duplicates shared absolute frame positions and marks `isCustomSpec` by comparing resolved spec identity to module default spec.

Internal docs should describe the editorial implication:

- Builder output is already “validated and stamped,” not raw draft state.

### 9. Catalog parsing and registry selection logic

Internal docs should document both raw catalog parsing and derived spec generation:

#### Raw CSV parsing (`src/core/rack/catalog_lists/catalogData.js`)

- `beams.csv` and `frames.csv` are imported as raw strings.
- CSV parsing is very simple:
  - split on newline
  - split headers and values on commas
  - trim values
- Numeric coercion happens during mapping.
- Canonical parsed arrays are:
  - `BEAMS_CSV`
  - `FRAMES_CSV`

#### Derived registry logic (`catalogRegistry.js`)

- Registry options are constrained to hard-coded allowed dimensions/classes:
  - frame heights `[96, 120, 144, 168, 192]`
  - frame depths `[36, 42]`
  - frame capacity classes `light, standard, medium, heavy`
  - beam lengths `[48, 92, 96, 102, 108, 120, 144]`
  - beam capacity classes `light, standard, medium, heavy`
- Registry selection is not “all rows”; it selects the **cheapest** CSV row within each dimension + capacity-class bucket.
- Frame capacity class is mapped by load-capacity ranges.
- Beam capacity class is also mapped by load-capacity ranges.
- `minimumTopClearanceIn` is hard-coded to `6` in generated frame specs.
- `basePlateType` is derived from gauge:
  - `gauge <= 12` => `HEAVY_DUTY`
  - otherwise `STANDARD`
- Beam `beamSeries` is derived from gauge:
  - `gauge <= 12` => `structural`
  - otherwise `standard`
- Beam `verticalEnvelopeIn` is currently set equal to `profileHeightIn`.
- `findFrameSpec()` and `findBeamSpec()` search the generated catalogs, not raw CSV rows.
- `getCompatibleBeams()` filters by both upright series and connector type.

Internal docs should explicitly mention:

- The registry is opinionated and collapses many raw CSV rows into one selected spec per allowed combination.

### 10. Validation engine: exact rule inventory

Internal docs should include a validation-rule matrix with error code, severity, trigger, and fix path. The current implemented rules in `validation.js` are:

#### Geometry / indexing / hole-grid rules

- `HOLE_GRID_MISALIGNED`
  - `holeIndex` must be a non-negative integer.
- `LEVEL_INDEX_NOT_CONSECUTIVE`
  - `levelIndex` values must be consecutive and start at `0`.
- `LEVELS_TOO_CLOSE`
  - adjacent levels violate strict ordering or required gap.

#### Height and clearance rules

- `LEVEL_EXCEEDS_FRAME_HEIGHT`
  - `holeIndex` exceeds max hole index for the frame.
- `INSUFFICIENT_TOP_CLEARANCE`
  - `elevationIn > frame.heightIn - minimumTopClearanceIn`
- `INSUFFICIENT_FLOOR_CLEARANCE`
  - first level is below configured floor clearance.
- `CONNECTOR_BELOW_GRADE`
  - first level elevation is below its beam connector envelope.

#### Compatibility rules

- `CONNECTOR_TYPE_MISMATCH`
  - beam connector type not accepted by frame.
- `CAPACITY_CLASS_EXCEEDED`
  - beam capacity rank exceeds frame capacity rank.
- `BEAM_INCOMPATIBLE_WITH_FRAME`
  - beam upright-series compatibility fails.
- `BEAM_LENGTH_MISMATCH`
  - bay beam length and level beam lengths differ.

#### Override-specific compatibility rules

- `FRAME_HEIGHT_EXCEEDED_OVERRIDE`
- `TOP_CLEARANCE_VIOLATED_OVERRIDE`
- `CONNECTOR_TYPE_MISMATCH_OVERRIDE`
- `CAPACITY_CLASS_EXCEEDED_OVERRIDE`
- `BEAM_INCOMPATIBLE_WITH_FRAME_OVERRIDE`

These exist because module-level shared levels must also be valid for every per-frame override spec.

#### Back-to-back / row-configuration rules

- `FRAME_DEPTH_NOT_UNIFORM`
  - in single-row lines: all default + override frame depths must match across the line
  - in back-to-back lines: depths must be uniform **within each rowIndex group**
- `ROW_SPACER_TOO_SMALL`
  - `backToBackConfig.rowSpacerSizeIn` is below configured minimum
- `MODULE_ROW_UNASSIGNED`
  - any module in a back-to-back line lacks `rowIndex`

#### Warning rules

- `NEAR_FRAME_TOP`
  - top beam remains within `0 < remaining <= 4` inches from frame top

#### State-derivation rules

- A line with no beam levels in any module is `INCOMPLETE`.
- Any blocking error makes the line `INVALID`.
- Warnings with no errors make the line `VALID_WITH_WARNINGS`.
- Otherwise the line is `VALID`.
- A design revision with zero lines is `INCOMPLETE`.
- A design revision becomes overall `INVALID` if any line is `INVALID` or `INCOMPLETE`.

Internal docs should also document validation options:

- `minimumFloorClearanceIn`
- `minimumRowSpacerIn`

### 11. Row spacer derivation

Internal docs should include a dedicated page for row spacers (`rowSpacerRules.js`):

- Spacer count is height-based:
  - `<= 144 in` => `2`
  - `145–216 in` => `3`
  - `> 216 in` => `4`
- `rowSpacerCountForModule()` sums spacers for each local frame and multiplies by `(rowCount - 1)`.
- `rowSpacerCountForModules()` de-duplicates shared absolute frame indices before summing.
- Draft UI uses `draftSpacersPerRowPair()` prior to committed module creation.

This rule affects both:

- editor preview expectations
- BOM quantities

### 12. Rack BOM derivation rules

Internal docs should describe deterministic BOM generation from `bomService.js`:

- Given the same rack line + catalog version, BOM output is intended to be deterministic.
- Frames are counted by grouping module `frameSpec.id`.
- Shared frames between modules are corrected by subtracting `modules.length - 1`.
- Adjusted frame counts are multiplied by row count.
- Beams are grouped by `level.beamSpec.id`.
- Beam quantity is:
  - `bay_count × levels × BEAMS_PER_LEVEL × rowCount`
- Safety pins are:
  - `totalBeams × SAFETY_PINS_PER_BEAM`
- Anchors are derived once per line using the **first module’s** frame base plate type.
- Anchor quantity is:
  - `frameIndices.length × anchorsPerFrame × rowCount`
- Row spacers are added only when `rowCount > 1`.
- `deriveDesignRevisionBOM()` merges identical SKUs across all rack lines.
- Merged BOM rules concatenate source-rule strings.

Internal docs should call out implementation assumptions:

- Anchor derivation assumes one base plate type per line.
- Frame grouping is by module `frameSpec.id`, while shared-frame correction is line-level.

### 13. CAD project document and persistence rules

Internal docs should document project-document behavior from `projectDocumentExporter.js` and `docs/project_document_schema.md`:

- Canonical document type is `rack-editor-project`.
- Schema version is currently `1.0.0`.
- Cache key prefix is `rack-editor:project:`.
- Cache scope default is `default`.
- Project serialization includes:
  - `documentType`
  - `schemaVersion`
  - `exportedAt`
  - `app`
  - `layout.entities`
  - `semantics.rackDomain.modules`
  - `semantics.wallStore`
  - `semantics.columnStore`
  - `canvas`
- Canvas normalization persists:
  - `darkMode`
  - `rackOrientation`
  - `drawingMode`
  - `wallMode`
  - `columnMode`
  - `showMeasurements`
- Rack-domain snapshot only includes domain objects referenced by layout entities of type `RACK_MODULE` or `RACK_LINE`.
- `isValidProjectDocument()` only checks a minimal schema:
  - object shape
  - matching document type
  - string schema version
  - `layout.entities` array
- Invalid documents are rejected during restore/import.
- Cache writes/reads fail safely and return booleans/nulls.
- Restoring a document:
  - replaces layout entities
  - restores wall and column stores if present
  - clears and repopulates `rackDomainRef.current`
  - restores canvas via callback if provided
- `downloadProjectDocument()` both caches and downloads the JSON payload.

Internal docs should explicitly explain the persistence boundary:

- The exported project document is not a normalized domain graph; it is a compatibility-first snapshot of current store shapes.

### 14. CAD-to-Quoter import rules

Internal docs should describe the import bridge implemented in `cadImportService.js`:

- Import expects `documentType === "rack-editor-project"`.
- The import path reads `semantics.rackDomain.modules`, not a full rack-line graph.
- Missing/empty module arrays do not throw; they return an empty BOM snapshot.
- `rowConfiguration` is inferred from layout entities by matching entity `domainId` to module `id`.
- `rowCountFromConfig()` parses strings like `BACK_TO_BACK_2`.
- Frame catalog resolution tries:
  1. exact `(heightIn, depthIn, gauge)`
  2. fallback `(heightIn, depthIn)`
- Beam catalog resolution tries:
  1. exact `(lengthIn, profileHeightIn)`
  2. fallback `(lengthIn)`
- Frame BOM import only counts modules with `rowIndex === 0` to avoid double-counting shared physical frames.
- Beam BOM import counts every beam level in every module and assumes `2` beams per level.
- Safety pins are added when `totalBeams > 0`.
- Anchor quantity is always `totalPhysicalFrames * 2` and always uses `ACC-ANCHOR-STANDARD`.
- Imported BOM items preserve hidden `_catalogCost`, `_catalogWeight`, and `_dims` metadata for downstream quote creation.
- `catalogVersion` is taken from `cadProject.app.version` or falls back to `web-v1`.
- Import session bridge uses `sessionStorage` key `quoter:pendingCadImport`.
- Reading pending import returns `{ raw, source: 'CAD Editor' }`.
- Clearing pending import silently ignores storage errors.
- `buildCatalogResolver()` exposes per-SKU cost/weight lookup from imported BOM items.

Internal docs should highlight a critical divergence:

- The import/BOM bridge does **not** mirror `cad/services/rack/bomService.js` exactly. It is a separate derivation path with its own counting and fallbacks.

### 15. Quote line-item rules

Internal docs should document the line-item schema in `quoteLineItemSchema.js`:

- Name is required.
- `source` must be one of `CAD_BOM` or `MANUAL`.
- `cost` must be finite and non-negative.
- `marginRate` must be finite and non-negative.
- `quantity` must be finite and positive.
- Price formula is:
  - `price = cost * (1 + marginRate)`
- Base line total is:
  - `price * quantity`
- Discount amount is computed from that base total.
- Final line total is clamped to `>= 0`.
- CAD-BOM-created lines are:
  - `source = CAD_BOM`
  - `isReadOnlyFromCad = true`
  - `isDesignLinked = true`
- BOM-derived line traceability includes:
  - `bomLineIndex`
  - `sku`
  - `rule`
  - `designId`
  - `designRevisionId`
- Catalog references include:
  - `sku`
  - `catalogVersion`
  - source path string
- Updating a CAD-linked line is blocked unless `allowCadOverrides = true`.
- Updates preserve:
  - original `id`
  - original `source`
  - original `traceability`
  - original read-only flags

Internal docs should call out a behavior nuance:

- CAD-linked lines are read-only for updates, but line removal is not similarly restricted by `canRemoveQuoteLineItem()`.

### 16. Quote aggregate rules

Internal docs should document the quote aggregate logic in `quoteSchema.js`:

- `createQuote()` supports both current fields and legacy aliases.
- Client normalization always returns an object with:
  - organization_name
  - first_name
  - last_name
  - email
  - phone
- Shipping must be finite and non-negative.
- Tax rates normalize to `{ id, name, rate >= 0 }`.
- Discounts and fees normalize through shared `normalizeEntry()`.
- Quote-format settings default several display flags to `true`, but line-item cost/discount visibility defaults to `false`.
- Quote totals are derived as:
  - `subtotal = sum(line_items.total)`
  - `total_discounts = computeEntriesTotal(subtotal, discounts)`
  - `total_fees = computeEntriesTotal(subtotal, fees)`
  - `total_tax_rates = sum(tax_rates.rate)`
  - `taxable_base = max(0, subtotal - total_discounts + shipping + total_fees)`
  - `tax_amount = taxable_base * total_tax_rates`
  - `total = taxable_base + tax_amount`
- `cad.project_file` is normalized to a string when present.
- Version entries are stored as frozen snapshots of quote data excluding versioning itself.
- Restoring a version keeps the existing version-history array intact.
- `withSyncedCadBom()` preserves manual line items and replaces the CAD-linked set.
- Synced CAD lines are placed before manual lines in the resulting array.

Internal docs should include every supported mutation:

- add/remove/update line items
- add/remove/update tax rates
- add/remove/update discounts
- add/remove/update fees
- save version
- restore version
- sync from CAD BOM

### 17. Quote store behavior

Internal docs should document the store-level lifecycle in `quoteStore.js`:

- The store starts from `createQuote()`.
- Every mutating operation pushes the previous quote into history before replacing state.
- Undo history is capped at `50` snapshots.
- `undo()` restores the last snapshot without recomputing from events.
- `resetQuote()` clears history and builds a fresh quote.
- `loadQuote()` clears history and rehydrates from provided quote data.
- `snapshot()` deep-clones via JSON serialize/parse.
- `getCadLineItems()` and `getManualLineItems()` are separate read projections.
- `setStatus()` rejects unsupported statuses.

Internal docs should describe the distinction between:

- quote schema rules
- quote store lifecycle behavior
- CAD sync behavior

### 18. Quoter shared helper rules

Internal docs should document `schemas/common.js`:

- Discount kinds:
  - `NONE`
  - `PERCENTAGE`
  - `FIXED_AMOUNT`
- Quote statuses:
  - `draft`
  - `sent`
  - `rejected`
  - `closed`
- Entry types:
  - `percentage`
  - `fixed`
- Default margin rate is `0.2`
- Default tax rate constant is `0.16`
- `roundCurrency()` rounds to 2 decimals by default.
- Percentage discounts above `100` throw.
- Fixed discounts are capped at the base amount.
- Percentage entries in `computeEntriesTotal()` are capped at `100`.
- All normalized discounts/fees must have finite non-negative values.
- Audit fields default timestamps to `now` and default `updatedBy` to `createdBy`.

### 19. Pricing-service rules vs Quoter pricing rules

Internal docs should not conflate these two layers:

#### Rack pricing service (`cad/services/rack/pricingService.js`)

- Prices a BOM snapshot from unit prices.
- Missing prices default to `0`.
- Manual overrides are per-SKU line totals.
- Result is a simple subtotal plus priced items.
- Determinism is framed around BOM + pricing table version.

#### Quoter pricing model (`quoter/services/schemas/*.js`)

- Uses cost, margin, quantity, discount, fees, shipping, and tax.
- CAD BOM sync creates quote line items but final quote totals are calculated by Quoter schema logic.
- Historical versions are stored inside the quote aggregate, not in the rack pricing service.

Internal docs should make it explicit which pricing path is:

- CAD-domain reference pricing
- commercial quoting behavior

### 20. Export and schema coverage that internal docs must include

Even if not part of the tiny user curriculum, internal docs should still cover:

- project-document export shape
- cache vs file download behavior
- validation of imported project documents
- semantic vs canvas payload split
- current lack of normalized rack-line serialization in the project document

### 21. Tests as rule-coverage map

Internal docs should reference `apps/web/src/apps/cad/services/rack/__tests__/rackDomain.test.js` as a coverage map because it verifies:

- frame count derivation
- hole-grid conversion
- spacing formula
- ordering constraints
- frame-height and floor-clearance rules
- rack-line shape patterns
- validation-state transitions
- BOM counts
- pricing expectations

This file is useful as a maintenance checklist for future doc updates.

### 22. Current code/doc mismatches and risk areas to document

The internal docs should include a “Current implementation caveats” section so future contributors do not assume the design docs perfectly match runtime behavior:

- `docs/model_schema.md` advocates derived-only fields and fewer ownership ambiguities, but current code still stores:
  - `isCustomSpec`
  - `isBeamSpecCustomized`
  - `elevationIn`
  - `rightFrameIndex`
  - `levelMode`
  - `totalBayCount`
  - `totalFrameCount`
  - `validationState`
- The project document stores `semantics.rackDomain.modules`, not a full normalized rack-line or revision graph.
- CAD-to-Quoter import uses a separate BOM derivation path from `cad/services/rack/bomService.js`.
- Imported BOM anchors are always `STANDARD`, while rack-domain BOM derivation uses `basePlateType`.
- Row spacer BOM behavior exists in rack-domain BOM service but is not mirrored in the CAD import BOM path.
- Quote line items from CAD are read-only for updates but removable under current removal logic.
- Quoter statuses implemented in code are narrower than the broader lifecycle states described in requirements docs.

### 23. Recommended new internal-doc pages from this audit

To avoid missing rules later, internal docs should expand to include at least these pages:

- **CAD store and entity lifecycle**
- **Rack constants and enums**
- **Frame / beam / bay / module / line invariants**
- **Catalog parsing and registry selection rules**
- **Validation rule matrix with error codes**
- **Back-to-back and row-spacer logic**
- **Deterministic BOM derivation rules**
- **Project document schema and restore behavior**
- **CAD-to-Quoter import bridge and BOM differences**
- **Quote line-item formulas and editability rules**
- **Quote totals, taxes, fees, discounts, and versioning**
- **Implementation caveats and doc/code mismatch register**

---

## Appendix — In-App Tutorial & Lab Implementation Architecture

### UX → Tech Stack Reasoning Chain

The following sections trace user experience goals directly to technical implementation decisions, matched to the existing app architecture (Next.js 14 App Router, pure JS, subscribe/notify stores).

---

### 1. Starting from user behavior

The user population has three profiles:

- **First-timer**: needs orientation without reading docs.
- **Returner**: knows the basics, wants to complete one specific task.
- **Power user**: wants to reference internal rules quickly.

The curriculum is intentionally short. The tutorial system should serve first-timers and returners, not power users. Power users read the internal docs.

From this we get three UX requirements:

1. Tutorial must be **available without navigating away from the canvas**.
2. Lab steps must be **validated in real-time** against actual canvas state (not fake scaffolding).
3. Progress must **persist across sessions** so the user doesn't restart.

---

### 2. UX options evaluated

#### Option A — Spotlight/tooltip tour (e.g., Shepherd.js)
- Pro: low friction, works without route changes
- Con: passive, no real validation of user actions, adds a third-party dependency

#### Option B — Dedicated tutorial routes (`/tutorials/lab-1`)
- Pro: clean isolation, full canvas available, pre-seeded starter state
- Con: user leaves their work to do the lab

#### Option C — Floating/sidebar tutorial panel alongside live canvas
- Pro: user works in their real canvas, validation is against real store state
- Con: panel competes for canvas real estate

#### Option D — Bottom drawer (slide-up from footer)
- Pro: unobtrusive, familiar pattern (chat-style)
- Con: less visible, easy to ignore

**Decision: Hybrid B + C**

- Use **Option C (sidebar panel)** when a tutorial is active on any page.
- Use **Option B (dedicated lab routes at `/tutorials/[labId]`)** for guided labs that start from a pre-seeded project.
- Use a lightweight spotlight/highlight (Option A, built-in, no library) for the onboarding orientation only.

The key insight: in Option B the lab route **renders the full CAD canvas** — the user is doing real work, just with a guided starting state. The panel overlays the canvas but the canvas is live.

---

### 3. UX wireframe (conceptual)

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

### 4. Data model for a tutorial/lab

Each lab is a plain JS module:

```js
// src/apps/tutorials/labs/lab-1-first-rack.js
export default {
  id: 'lab-1-first-rack',
  title: 'Build Your First Rack',
  description: 'Place a rack module and configure two levels.',
  estimatedMinutes: 5,
  starterProject: null, // null = blank canvas, or a project JSON object

  steps: [
    {
      id: 'step-add-rack',
      title: 'Add a rack module',
      description: 'Click the "Add Rack" button in the EditorPanel on the left.',
      hint: 'Look for the blue "+ Rack" button at the top of the left panel.',
      spotlight: 'button[data-tutorial="add-rack"]', // CSS selector for spotlight
      // Checkpoint: passes when at least one RACK_MODULE entity exists
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
      checkpoint({ rackDomainRef, layoutStore }) {
        // Check the validation state stored in the first rack entity
        const racks = layoutStore.getAllByType('RACK_MODULE');
        return racks.some((r) => r.validationState === 'VALID');
      },
    },
  ],
};
```

Key properties:

- `starterProject`: can be `null` for blank canvas or a full project-document JSON object that is restored on lab load.
- `checkpoint(context)`: pure function that receives live store references and returns `boolean`. No mocking. No faking. Real state.
- `spotlight`: CSS selector; when set, a semi-transparent overlay dims everything except the targeted element.

---

### 5. Tutorial store (state layer)

Follows the exact same store pattern as `layoutStore` and `quoteStore`:

```js
// src/apps/tutorials/tutorialStore.js
export function createTutorialStore(options = {}) {
  let _activeLab = null;       // current lab definition object
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

  return { subscribe: (fn) => { _listeners.push(fn); return () => { ... }; }, startLab, advanceStep, completeLab, exitLab, setCollapsed, getState };
}
```

The tutorial store is a singleton (`src/apps/tutorials/tutorialSingleton.js`) just like `quoteSingleton.js`.

---

### 6. React integration layer

```js
// src/apps/tutorials/hooks/useTutorialStore.js
import { useSyncExternalStore, useRef } from 'react';
import { createTutorialStore } from '../tutorialStore';
import { getTutorialStore } from '../tutorialSingleton';

export default function useTutorialStore() {
  const store = getTutorialStore(); // singleton
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { store, state };
}
```

This mirrors `useLayoutStore`, `useQuoteStore`, etc. exactly.

---

### 7. Checkpoint polling

Lab checkpoints need to re-run as the canvas state changes. The best approach is to hook into existing store subscriptions:

```js
// Inside TutorialPanel component
useEffect(() => {
  if (!state.currentStep?.checkpoint) return;

  // Subscribe to layout/rackDomain changes to re-evaluate checkpoint
  const unsub = layoutStore.subscribe(() => {
    const passed = state.currentStep.checkpoint({
      layoutStore,
      rackDomainRef,
    });
    if (passed) tutorialStore.advanceStep();
  });

  return unsub;
}, [state.currentStepIndex, layoutStore, rackDomainRef, tutorialStore]);
```

No polling loop. No `setInterval`. Pure subscription-based reactivity, consistent with how all stores work.

---

### 8. Spotlight mechanism

The spotlight overlay is a CSS-only overlay approach that requires no external library:

```js
// src/apps/tutorials/components/TutorialSpotlight.js
// Renders a full-page overlay with a CSS clip-path or box-shadow cutout
// centered on the targeted element's getBoundingClientRect.
// Uses a ResizeObserver to track element movement.
```

When `currentStep.spotlight` is set, the TutorialSpotlight component:
- measures the target element with `querySelector` + `getBoundingClientRect`
- renders a `position: fixed` overlay with an SVG mask or `box-shadow: 0 0 0 9999px rgba(0,0,0,0.5)` with a transparent cutout
- tracks resize/scroll with `ResizeObserver`

---

### 9. Routing for labs

New routes added to the Next.js App Router:

```
app/
  tutorials/
    page.js           ← Lab index (list all labs + completion status)
    [labId]/
      page.js         ← Loads lab definition, restores starterProject,
                         renders CadWorkspacePage + TutorialPanel
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
    // Restore starter project if provided
    if (lab.starterProject) {
      projectStore.openFromDocument(lab.starterProject);
    }
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

The key: `CadWorkspacePage` renders exactly as it does on `/`. The tutorial is an overlay. No duplication of canvas logic.

---

### 10. Lab registry

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

---

### 11. Progress persistence

Tutorial completion state uses `localStorage`:

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

Same safe-fail pattern used by `projectDocumentExporter.js`.

---

### 12. Navigation integration

Add "Tutorials" to the `AppRailNav` sidebar navigation:

```js
// In AppRailNav.js, add an entry:
{ label: 'Tutorials', href: '/tutorials', icon: <BookOpenIcon /> }
```

The tutorials index page (`/tutorials`) shows:
- Each lab as a card
- Title, description, time estimate
- Completion badge if `completedLabs.has(lab.id)`
- "Start Lab" button

---

### 13. File system layout

All tutorial code lives in a new feature module following the existing pattern:

```
src/apps/tutorials/
  tutorialStore.js          ← store factory
  tutorialSingleton.js      ← singleton + reset for tests
  labRegistry.js            ← registry of all labs
  hooks/
    useTutorialStore.js     ← React hook
  components/
    TutorialPanel.js        ← floating step panel
    TutorialSpotlight.js    ← spotlight overlay
    LabCard.js              ← card for index page
  labs/
    lab-1-first-rack.js
    lab-2-send-to-quoter.js
    lab-3-add-quote-line.js
  styles/
    tutorial.css            ← panel styles

app/tutorials/
  page.js                   ← lab index
  [labId]/
    page.js                 ← lab runner
```

---

### 14. Quoter labs (cross-page)

For labs that span CAD → Quoter, the flow is:

1. Lab step N: user is on `/tutorials/lab-2-send-to-quoter` (CAD lab route)
2. Checkpoint: `layoutStore.getAllByType('RACK_MODULE').length > 0`
3. Tutorial step: "Click 'Send to Quoter'"
4. On click, the existing `handleSendToQuoter` fires, which pushes to `/quoter`
5. The tutorial store state persists in the singleton (module-scope memory)
6. `QuoterPage` renders `TutorialPanel` if `tutorialStore.getState().isActive`
7. Next steps validate `quoteStore` state (line_items, totals)

This requires `TutorialPanel` to be rendered in `QuoterPage` too. Context is passed through the singleton — no prop drilling.

---

### 15. What the tutorial system does NOT need

To keep the implementation lean:

- No external tour library (Shepherd.js, Intro.js, etc.)
- No server-side persistence (localStorage is sufficient)
- No video embeds (steps are text + spotlight)
- No animation framework beyond CSS transitions
- No separate backend for content (lab definitions are JS files)

This keeps the implementation entirely within the existing tech stack without new dependencies.

---

### 16. Risks and open questions

- **Checkpoint brittleness**: checkpoints depend on store shape; when store shape changes, checkpoints must be updated. The internal-doc audit reduces this risk by documenting all shapes explicitly.
- **Lab starter projects**: if the schema version changes, stored starter-project JSONs will need migration. The existing `isValidProjectDocument()` check provides the guard.
- **Quoter cross-page continuity**: the tutorial store singleton survives navigation because it is module-scoped memory, but if the user refreshes mid-lab on the Quoter page, the active lab is lost. A `sessionStorage` fallback for active lab state would fix this.
- **Spotlight element targeting**: if UI components are restructured (e.g., button moves), CSS selectors break silently. Using `data-tutorial="..."` attributes on targeted elements is more resilient than class/tag selectors.
