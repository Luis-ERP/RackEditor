RACK EDITOR — DOMAIN MODEL SCHEMA
Version: 1.0 — Design Document
Purpose: Define the canonical data structures, their relationships, invariants,
         and derived properties for the rack configuration domain.

This document supersedes ad-hoc model extensions. Any change to the domain
structures must be evaluated against the invariants here first.

─────────────────────────────────────────────────────────────────────────────
0.  PROBLEMS WITH THE CURRENT MODEL
─────────────────────────────────────────────────────────────────────────────

The current implementation has seven structural problems. They are described
first so that the rationale for the schema below is clear.

0.1  Frame ownership is ambiguous at module boundaries

    A RackLine is composed of consecutive RackModules that share adjacent
    frames. The current model stores `frameSpec` (the module default) and
    `frameOverrides` (a sparse Record<localIndex, FrameSpec>) inside the
    RackModule. This means the physical frame at the shared position between
    module[i] and module[i+1] is represented by TWO different objects: the
    last entry in module[i]'s override map and the first entry in module[i+1]'s
    override map. There is no defined rule for which one governs the physical
    frame. This is a silent ambiguity that the BOM and the canvas renderer
    will resolve differently depending on iteration order.

0.2  levelUnion and Bay.levels are redundant and can diverge

    RackModule.levelUnion defines "the shared beam level config" for all bays
    in the module. Each Bay also carries its own `levels` array. The factory
    initialises both to the same array, so they start identical. After a
    bay-level customization (via withBayBeamSpec or withBeamLevelSpec), the bay
    levels change but levelUnion does not. The data model now contains two
    conflicting sources of truth for beam level configuration. There is no
    synchronisation mechanism and no documented authority rule.

0.3  isCustomSpec / isBeamSpecCustomized are boolean flags in the wrong layer

    Adding `isCustomSpec: boolean` to Frame and `isBeamSpecCustomized: boolean`
    to Bay and BeamLevel turns UI presentation concerns into domain data.
    The canonical answer to "is this customized?" is already in the data:
    compare the item's spec to its siblings. Storing a flag that can go stale
    (e.g. if a user un-customizes a frame, the flag must be explicitly reset)
    creates a new class of consistency bugs. Flags belong in a view-model
    layer, not in the domain.

0.4  Derived values are stored, creating inconsistency risk

    BeamLevel.elevationIn is always holeIndex × HOLE_STEP_IN. It is computed
    in createBeamLevel and stored in the frozen object. If an object is ever
    constructed with a mismatched elevationIn (e.g. during a migration or a
    test), no runtime check catches it. Similarly, Bay.rightFrameIndex is
    always leftFrameIndex + 1, and RackModule.endFrameIndex is always
    startFrameIndex + bays.length. These should not be stored.

0.5  Bay carries redundant frame-position data

    Bay.leftFrameIndex and Bay.rightFrameIndex store absolute line-position
    indices. But a bay's position is already fully determined by its index
    within a module and the module's startFrameIndex. Storing frame indices
    inside bays creates a second source of truth for bay geometry that can
    diverge from the module's frame array.

0.6  Bay.beamSpec is a ghost field

    Bay has a top-level `beamSpec` AND each BeamLevel inside it also has a
    `beamSpec`. The validation function (validateBayBeamLength) checks that all
    level specs match the bay's spec, which means they should always agree.
    If that invariant holds, the bay-level beamSpec is redundant. If it does
    not hold, the data is invalid. Either way, maintaining two spec references
    per bay adds complexity without value.

0.7  LevelMode on RackLine can lie

    RackLine.levelMode is stored as UNIFORM or VARIABLE. Nothing prevents the
    data from containing variable levels while levelMode reads UNIFORM, or vice
    versa. Uniformity is a property that should be derived from the actual bay
    data, not stored as a flag.

─────────────────────────────────────────────────────────────────────────────
1.  DESIGN PRINCIPLES
─────────────────────────────────────────────────────────────────────────────

  P1. The domain model stores configuration facts, not their interpretations.
      Derived values (elevation, rightFrameIndex, totalBayCount, isUniform,
      isCustomized) are computed on demand.

  P2. There is exactly one owner for each piece of data. Frame configurations
      are owned by the RackLine, not by modules. Beam level configurations are
      owned by each bay independently.

  P3. Catalog specs (FrameSpec, BeamSpec) are immutable reference objects.
      Configuration instances reference catalog specs; they do not copy them.
      Shared specs means the same object reference (identity equality).

  P4. Customization is structural, not flagged. Every frame position carries
      its own FrameConfig and every beam level carries its own BeamLevelConfig.
      Whether a frame "differs" from its neighbours is a derived comparison,
      not a stored boolean.

  P5. Module boundaries are editing zones, not ownership containers. The module
      concept exists to support bulk editing (apply one frame spec to a range,
      apply the same levels to all bays in a zone). It has no structural claim
      over the frames it spans.

  P6. No stored uniformity guarantees. LevelMode and isCustomSpec are removed
      from the domain model. The factory layer provides helpers to initialise
      structurally uniform modules, and the query layer provides helpers to
      inspect whether uniformity still holds.

─────────────────────────────────────────────────────────────────────────────
2.  LAYER OVERVIEW
─────────────────────────────────────────────────────────────────────────────

    ┌─────────────────────────────────────────────────┐
    │  CATALOG LAYER  (read-only, loaded from CSV)    │
    │                                                 │
    │  FrameSpec    BeamSpec    AccessorySpec         │
    └─────────────────────────────────────────────────┘
                         │  referenced by
    ┌─────────────────────────────────────────────────┐
    │  CONFIGURATION LAYER  (the rack design)         │
    │                                                 │
    │  DesignRevision                                 │
    │    └── RackLine[]                               │
    │          ├── FrameConfig[]   (flat, by position)│
    │          └── ModuleConfig[]  (editing zones)    │
    │                └── BayConfig[]                  │
    │                      └── BeamLevelConfig[]      │
    └─────────────────────────────────────────────────┘
                         │  derived from
    ┌─────────────────────────────────────────────────┐
    │  DERIVED LAYER  (computed, never stored)        │
    │                                                 │
    │  Frame instances, BOM, geometry, pricing        │
    └─────────────────────────────────────────────────┘

─────────────────────────────────────────────────────────────────────────────
3.  CATALOG LAYER
─────────────────────────────────────────────────────────────────────────────

These types are sourced from the CSV catalog files in
apps/web/src/core/rack/catalog_lists (frames.csv, beams.csv).
They are created once at application start and never mutated.

────────────────────────────────────────
3.1  FrameSpec
────────────────────────────────────────

  Fields:
    id              string    — Catalog SKU. Globally unique.
    heightIn        number    — Frame height in inches. Positive.
    depthIn         number    — Frame depth in inches. Positive.
    gauge           string    — Steel gauge designation (e.g. '14').
    capacityClass   string    — Structural capacity class.
    uprightSeries   string    — Upright profile identifier.
    basePlateType   string    — 'STANDARD' | 'HEAVY_DUTY'

  Constraints:
    heightIn > 0
    depthIn > 0

  Notes:
    FrameSpec does not carry a `holeCount` field. Hole count is derived:
      holeCount = floor(heightIn / HOLE_STEP_IN)
    Hole positions are always 0-based: hole 0 = elevation 0", hole n = n×2".

────────────────────────────────────────
3.2  BeamSpec
────────────────────────────────────────

  Fields:
    id                       string    — Catalog SKU. Globally unique.
    lengthIn                 number    — Beam length in inches. Positive.
                                         This is also the implied bay width.
    capacityClass            string    — Structural capacity class.
    beamSeries               string    — Beam profile series.
    connectorType            string    — Connector type (must match frame slot).
    verticalEnvelopeIn       number    — Vertical clearance consumed by the
                                         connector assembly. Non-negative.
    compatibleUprightSeries  string[]  — Upright series this beam can attach to.
                                         Non-empty.

  Constraints:
    lengthIn > 0
    verticalEnvelopeIn ≥ 0
    compatibleUprightSeries.length ≥ 1

────────────────────────────────────────
3.3  AccessorySpec
────────────────────────────────────────

  Fields:
    id          string  — Catalog SKU. Globally unique.
    name        string  — Human-readable name.
    category    string  — 'DERIVED' | 'EXPLICIT'
    scope       string  — 'RACK_LINE' | 'BAY' | 'LEVEL'
    description string  — Optional.

─────────────────────────────────────────────────────────────────────────────
4.  CONFIGURATION LAYER
─────────────────────────────────────────────────────────────────────────────

────────────────────────────────────────
4.1  BeamLevelConfig
────────────────────────────────────────

  A single beam level within a bay. Determines where a pair of beams sits on
  the frame uprights and which beam catalog item is used.

  Fields:
    id          string    — Instance ID. Unique within the design.
    levelIndex  number    — Ordering index. 0 = lowest level. Strictly
                            increasing within a bay. Non-negative integer.
    holeIndex   number    — Hole position on the upright. Non-negative integer.
                            Strictly increasing within a bay.
    spec        BeamSpec  — Reference to the catalog beam spec. Not a copy.

  Constraints:
    levelIndex ≥ 0, integer
    holeIndex ≥ 0, integer
    holeIndex × HOLE_STEP_IN ≤ min(leftFrame.spec.heightIn, rightFrame.spec.heightIn)
    spec.compatibleUprightSeries includes leftFrame.spec.uprightSeries
    spec.compatibleUprightSeries includes rightFrame.spec.uprightSeries
    spec.lengthIn === parentBay.widthIn

  Derived (not stored):
    elevationIn = holeIndex × HOLE_STEP_IN

  Notes:
    There is exactly one spec per level. There is no "level default vs level
    override" — whatever spec this level holds is its current configuration.
    If the user changes the spec of a single level, they create a new
    BeamLevelConfig with the new spec and the same id/levelIndex/holeIndex.

────────────────────────────────────────
4.2  BayConfig
────────────────────────────────────────

  A bay is the horizontal span between two adjacent frame positions. It is
  the unit that holds beam levels and bay-scoped accessories.

  Fields:
    id          string              — Instance ID. Unique within the design.
    widthIn     number              — Bay width in inches. Positive. Must equal
                                      beamLevels[*].spec.lengthIn for all levels.
    beamLevels  BeamLevelConfig[]   — Ordered by levelIndex ascending. May be
                                      empty for an incomplete configuration.
    accessoryIds string[]           — IDs of explicitly applied accessories.

  Constraints:
    widthIn > 0
    beamLevels sorted strictly ascending by levelIndex
    beamLevels sorted strictly ascending by holeIndex
    ∀ level ∈ beamLevels: level.spec.lengthIn === widthIn
    ∀ adjacent (lower, upper) in beamLevels:
      upper.holeIndex − lower.holeIndex ≥ minimumGapSteps(lower.spec, upper.spec)

  Derived (not stored):
    bayIndex  — position of this bay within its parent module (index in module.bays)
    framePositions — derived from module.startFrameIndex + bayIndex (left frame)
                     and module.startFrameIndex + bayIndex + 1 (right frame)
    physicalBeamCount = beamLevels.length × 2   (two beams per level: left + right)

  Notes:
    Bay does NOT store leftFrameIndex or rightFrameIndex. Frame geometry is
    resolved through the parent module and the line's frames array. This
    eliminates redundant frame-index encoding inside each bay.

    "Bay width" is the beam length, and it is stored explicitly so that an
    empty bay (no levels yet placed) still has a defined width.

────────────────────────────────────────
4.3  ModuleConfig
────────────────────────────────────────

  A module is a contiguous editing zone within a rack line. It defines a
  range of frame positions and contains the bays between them. Modules are
  the unit for bulk editing: changing a frame spec for all frames in a zone,
  or setting identical beam levels across all bays in a zone.

  Fields:
    id               string        — Instance ID. Unique within the design.
    startFrameIndex  number        — Absolute index into RackLine.frames for the
                                     leftmost frame of this module. Non-negative.
    bays             BayConfig[]   — Ordered left to right. At least 1.

  Constraints:
    bays.length ≥ 1
    startFrameIndex ≥ 0, integer
    endFrameIndex = startFrameIndex + bays.length  (must be < line.frames.length)

  Derived (not stored):
    endFrameIndex = startFrameIndex + bays.length
    frameCount    = bays.length + 1
    frameIndices  = [startFrameIndex, startFrameIndex+1, ..., startFrameIndex + bays.length]

  Relationship to frames:
    bay[j] spans line.frames[startFrameIndex + j] (left) and
                  line.frames[startFrameIndex + j + 1] (right).
    The module does NOT own those frames. It points into line.frames.

  Notes:
    There is no `frameSpec` default field on ModuleConfig. The factory layer
    provides helpers that create N identical FrameConfigs and insert them into
    line.frames when building a module. The stored model only carries the
    resulting flat frame array. This eliminates the default+override split.

    There is no `levelUnion` field. When a module is initialised with uniform
    beam levels, each bay gets its own copy of identical BeamLevelConfig
    objects. Uniformity is inspected via isModuleBeamLevelsUniform() from the
    query layer.

────────────────────────────────────────
4.4  FrameConfig
────────────────────────────────────────

  A FrameConfig represents one physical frame at one position in a rack line.

  Fields:
    id    string     — Instance ID. Unique within the design.
    spec  FrameSpec  — Reference to the catalog frame spec. Not a copy.

  Notes:
    There is one FrameConfig per unique physical frame position in the line.
    The position is implicit: line.frames[i] is the frame at absolute index i.
    FrameConfig is owned by RackLine.frames, not by any module.

    Customization is natural: if the user overrides a single frame, they
    replace line.frames[i] with a new FrameConfig referencing a different
    FrameSpec. The fact that it differs from its neighbours is observable by
    comparison (frames[i].spec !== frames[i-1].spec), not by a stored flag.

    HEIGHT may vary between positions (e.g. taller frames in the middle of a
    line — see Section 13). DEPTH must be uniform across all positions in the
    same line (see [V9] and Section 4.5 constraint below). Swapping a frame
    for one with a different depth requires changing every other frame in the
    line at the same time — and is therefore a line-level operation, not a
    single-frame operation.

────────────────────────────────────────
4.5  RackLine
────────────────────────────────────────

  The complete configuration of one physical rack run.

  Fields:
    id                string            — Instance ID. Unique within the design.
    frames            FrameConfig[]     — Flat ordered array. One entry per
                                          unique physical frame position.
                                          frames.length = totalFrameCount.
    modules           ModuleConfig[]    — Ordered left to right. Non-empty.
    rowConfiguration  string            — 'SINGLE' | 'BACK_TO_BACK_2' |
                                          'BACK_TO_BACK_3' | 'BACK_TO_BACK_4'
    backToBackConfig  BackToBackConfig  — Required when rowConfiguration ≠ SINGLE.
                                          null otherwise.
    validationState   string            — 'INCOMPLETE' | 'VALID' |
                                          'VALID_WITH_WARNINGS' | 'INVALID'
    accessoryIds      string[]          — Line-scoped explicit accessories.

  Constraints:
    frames.length ≥ 2
    modules.length ≥ 1
    modules cover all frame-bounded bays without gaps:
      modules[0].startFrameIndex = 0
      modules[i+1].startFrameIndex = modules[i].startFrameIndex + modules[i].bays.length
      modules[last].startFrameIndex + modules[last].bays.length = frames.length − 1
    Consecutive modules share exactly one frame:
      modules[i].endFrameIndex = modules[i+1].startFrameIndex
    rowConfiguration ∈ {SINGLE, BACK_TO_BACK_2, BACK_TO_BACK_3, BACK_TO_BACK_4}
    rowConfiguration ≠ SINGLE → backToBackConfig ≠ null
    validationState ∈ {INCOMPLETE, VALID, VALID_WITH_WARNINGS, INVALID}
    [DEPTH UNIFORMITY] ∀ i, j ∈ [0, frames.length−1]: frames[i].spec.depthIn === frames[j].spec.depthIn
      Frame depth defines the physical footprint of the line (the front-to-back
      aisle dimension). All frames in the same line must share the same depth;
      otherwise the pallet reference plane shifts between bays, producing a
      geometrically incoherent structure that cannot be manufactured or installed.
      Changing the depth of a rack line means replacing every frame simultaneously,
      which is a line-level operation validated by [V9].
      Note — back-to-back rows: in a back-to-back configuration both rows are
      represented in the same RackLine. All frames therefore include the frames
      of every row. In practice, all rows in a back-to-back typically share the
      same depth, but the allowance for row A and row B to differ (referenced in
      business_rules_racks.md Section 9.2) is a spacer-calculation concern, not
      a per-frame depth variation within a single row. [V9] enforces this.

  Derived (not stored):
    totalBayCount   = sum(mod.bays.length for mod in modules)
    totalFrameCount = frames.length

  Notes:
    LevelMode (UNIFORM / VARIABLE) is NOT stored. Whether all bays share the
    same beam level configuration is derivable from the data:
      isLineLevelsUniform(line) → bool
    Storing it as a flag risks contradicting the actual data.

    The 'frames' array is the single authoritative source for all frame
    configurations. Any operation that changes a frame spec replaces the entry
    in this array. The modules array does not need updating.

────────────────────────────────────────
4.6  BackToBackConfig
────────────────────────────────────────

  Fields:
    rowSpacerSizeIn  number  — Spacer size between rows, in inches. Positive.
    rowCount         number  — 2 | 3 | 4

  Constraints:
    rowSpacerSizeIn > 0
    rowCount ∈ {2, 3, 4}

────────────────────────────────────────
4.7  DesignRevision
────────────────────────────────────────

  An immutable snapshot of a complete rack configuration state.

  Fields:
    id                string            — Unique revision ID.
    revisionNumber    number            — Monotonically increasing. ≥ 1.
    catalogVersion    string            — Catalog version used.
    createdAt         string            — ISO 8601 timestamp.
    rackLines         RackLine[]        — All rack lines in scope.
    accessories       Accessory[]       — All accessory instances in scope.
    validationResults object            — Aggregated validation results.
    bomSnapshot       object | null     — Cached BOM. null until computed.

  Constraints:
    revisionNumber ≥ 1, integer
    Given (id, catalogVersion) → BOM is deterministic (Section 19 of biz rules)
    bomSnapshot must be recomputed (set to null) whenever rackLines or
    accessories change (i.e. when creating a new derived revision).

─────────────────────────────────────────────────────────────────────────────
5.  FRAME SHARING BETWEEN MODULES (CRITICAL INVARIANT)
─────────────────────────────────────────────────────────────────────────────

  By the module coverage constraint (Section 4.5), consecutive modules share
  the frame at the boundary position:

    modules[i].endFrameIndex  =  modules[i+1].startFrameIndex  =  k

  Physical reality: there is one steel frame at position k.

  In this schema: there is exactly one FrameConfig in line.frames[k]. Both
  modules reference it by index. There is no duplication and no ambiguity.

  Changing the spec of the shared frame means:

    line.frames[k] = newFrameConfig(newSpec)

  Both modules automatically see the change because they both point to index k
  in the line's frames array. No override map needs to be managed.

─────────────────────────────────────────────────────────────────────────────
6.  CUSTOMIZATION MODEL
─────────────────────────────────────────────────────────────────────────────

  Customization is a state of the data, not a metadata flag. Because every
  frame position has exactly one FrameConfig and every beam level has exactly
  one BeamLevelConfig, "customizing" a frame, a bay, or a level means
  replacing the relevant configuration object.

  6.1  Change one frame's spec

    Produce a new RackLine with frames[i] replaced:

      function setFrameSpec(line, frameIndex, newSpec):
        const newFrames = [...line.frames]
        newFrames[frameIndex] = createFrameConfig({ id: line.frames[frameIndex].id, spec: newSpec })
        return createRackLine({ ...line, frames: newFrames })

    Consumer code that wants to know if a frame differs from its neighbours:

      isDifferentFromNeighbours(line.frames, i)  →  bool

    No isCustomSpec flag needed.

  6.2  Change one bay's beam spec for all levels

    Produce a new ModuleConfig with bays[j] replaced, where each
    BeamLevelConfig in that bay gets a new spec:

      function setBayBeamSpec(module, bayIndex, newSpec):
        const newLevels = bay.beamLevels.map(lvl =>
          createBeamLevelConfig({ ...lvl, spec: newSpec })
        )
        const newBay = createBayConfig({ ...bay, beamLevels: newLevels })
        ...

    The bay's widthIn must be updated if the new spec has a different lengthIn.

  6.3  Change one level's spec within a bay

    Produce a new BayConfig with beamLevels[k] replaced:

      function setBayLevelSpec(bay, levelIndex, newSpec):
        const newLevels = bay.beamLevels.map(lvl =>
          lvl.levelIndex === levelIndex
            ? createBeamLevelConfig({ ...lvl, spec: newSpec })
            : lvl
        )
        return createBayConfig({ ...bay, beamLevels: newLevels })

  6.4  Apply one frame spec to all frames in a module zone

      function setModuleFrameSpec(line, moduleIndex, newSpec):
        const mod = line.modules[moduleIndex]
        const newFrames = [...line.frames]
        for (let i = mod.startFrameIndex; i <= mod.endFrameIndex; i++) {
          newFrames[i] = createFrameConfig({ ...line.frames[i], spec: newSpec })
        }
        return createRackLine({ ...line, frames: newFrames })

  6.5  Apply uniform beam levels to all bays in a module zone

      function setModuleBeamLevels(line, moduleIndex, beamLevelConfigs):
        — Creates a new ModuleConfig where every bay gets a copy of the
          provided beamLevelConfigs (with new IDs to preserve identity).

─────────────────────────────────────────────────────────────────────────────
7.  QUERY HELPERS (DERIVED, NOT STORED)
─────────────────────────────────────────────────────────────────────────────

  These functions answer common questions about the configuration without
  requiring stored flags.

  isModuleFramesUniform(line, moduleIndex) → bool
    True if every frame in the module's range has the same spec id.

  isModuleBeamLevelsUniform(module) → bool
    True if every bay in the module has the same number of levels,
    the same hole indices, and the same spec ids in the same order.

  isLineLevelsUniform(line) → bool
    True if every bay across the entire line satisfies the above.

  frameAt(line, absoluteIndex) → FrameConfig
    Direct index into line.frames. O(1).

  bayFrames(line, module, bayIndex) → { left: FrameConfig, right: FrameConfig }
    Returns the two FrameConfigs bounding a given bay.

  elevationOf(level) → number
    level.holeIndex × HOLE_STEP_IN

  frameHoleCount(frameConfig) → number
    floor(frameConfig.spec.heightIn / HOLE_STEP_IN)

  isBeamCompatible(beamLevelConfig, frameConfig) → bool
    beamLevelConfig.spec.compatibleUprightSeries.includes(frameConfig.spec.uprightSeries)

─────────────────────────────────────────────────────────────────────────────
8.  STRUCTURAL VALIDATION RULES
─────────────────────────────────────────────────────────────────────────────

  The following rules produce INVALID state when violated:

  [V1] Beam-frame compatibility
       ∀ level in bay: isBeamCompatible(level, leftFrame) && isBeamCompatible(level, rightFrame)

  [V2] Beam length matches bay width
       ∀ level in bay: level.spec.lengthIn === bay.widthIn

  [V3] Level hole grid alignment
       ∀ level in bay: level.holeIndex is a non-negative integer

  [V4] Level strict ordering
       ∀ adjacent (a, b) in bay.beamLevels: b.holeIndex > a.holeIndex

  [V5] Minimum level spacing
       ∀ adjacent (lower, upper) in bay.beamLevels:
         upper.holeIndex − lower.holeIndex ≥ minimumGapSteps(lower.spec, upper.spec)
         where minimumGapSteps = ceil((HOLE_STEP_IN + max(lower.spec.verticalEnvelopeIn,
                                                           upper.spec.verticalEnvelopeIn))
                                       / HOLE_STEP_IN)

  [V6] Level fits within frame height
       ∀ level in bay: level.holeIndex ≤ frameHoleCount(leftFrame)
                       level.holeIndex ≤ frameHoleCount(rightFrame)

  [V7] Module frame range within line bounds
       ∀ module: module.endFrameIndex < line.frames.length

  [V8] Module continuity
       modules cover all frame positions with no gaps or overlaps

  [V9] Frame depth uniformity within a rack line
       ∀ i ∈ [0, line.frames.length−1]:
         line.frames[i].spec.depthIn === line.frames[0].spec.depthIn

       Rationale: frame depthIn is the front-to-back dimension of the upright
       (the "how far into the aisle" dimension). Every frame in the line stands
       on the same floor strip and shares the same back-of-rack plane. If frames
       had differing depths:
         • The back-of-rack plane would step in/out between bays.
         • Pallet positioning would be inconsistent across bays.
         • Beam seating geometry would be indeterminate.
         • Canvas and geometry derivation (Section 18) would be unsolvable
           without storing an additional per-frame offset — prohibited by P1.

       HEIGHT is allowed to vary (see Section 13 for a worked example).
       DEPTH is not. This is a line-level invariant enforced at validation time.

  The following rule produces VALID_WITH_WARNINGS when violated:

  [W1] Near-capacity beam or frame usage
       (capacity check thresholds are catalog-defined)

─────────────────────────────────────────────────────────────────────────────
9.  FACTORY PATTERNS
─────────────────────────────────────────────────────────────────────────────

  The following factory shortcuts initialise structurally uniform modules.
  They do not store the "default" — they produce concrete, fully specified
  configuration data.

  buildUniformModule(frameSpec, beamSpec, holeIndices, bayCount, bayWidthIn) → { frames, module }
    Creates (bayCount + 1) FrameConfig objects all referencing frameSpec.
    Creates one BayConfig per bay, each containing identical BeamLevelConfig
    objects built from holeIndices × beamSpec pairs.
    Returns the FrameConfig array slice and the ModuleConfig.

  buildRackLine(moduleSpecs, rowConfiguration, backToBackConfig) → RackLine
    Calls buildUniformModule for each module spec, concatenates the frame
    arrays (de-duplicating the shared boundary frame: the right frame of
    module[i] and the left frame of module[i+1] are the SAME FrameConfig
    object at the shared position), assembles the final RackLine.

  buildSimpleRackLine(frameSpec, beamSpec, holeIndices, bayCount) → RackLine
    Convenience wrapper: one module, SINGLE row, uniform levels.

─────────────────────────────────────────────────────────────────────────────
10.  WHAT CHANGES FROM THE CURRENT IMPLEMENTATION
─────────────────────────────────────────────────────────────────────────────

  Removed from RackModule:
    - frameSpec           → factory concern; not stored in module
    - frameOverrides      → eliminated; replaced by RackLine.frames flat array
    - levelUnion          → eliminated; each bay independently owns its levels
    - startFrameIndex     → kept (still needed to locate bays in line.frames)
    - endFrameIndex       → DERIVED (startFrameIndex + bays.length), not stored

  Removed from Bay:
    - leftFrameIndex      → DERIVED from module position, not stored in bay
    - rightFrameIndex     → DERIVED from module position, not stored
    - beamSpec            → ELIMINATED; bay-level "default spec" collapses into
                             individual BeamLevelConfig.spec per level
    - isBeamSpecCustomized → ELIMINATED; flag; use comparison instead

  Removed from BeamLevel:
    - elevationIn         → DERIVED (holeIndex × HOLE_STEP_IN), not stored
    - isBeamSpecCustomized → ELIMINATED; flag; use comparison instead

  Removed from Frame (instance):
    - isCustomSpec        → ELIMINATED; flag; use comparison instead

  Removed from RackLine:
    - levelMode           → ELIMINATED; derived from isLineLevelsUniform(line)
    - totalBayCount       → DERIVED; sum of module bay counts
    - totalFrameCount     → DERIVED; line.frames.length

  Added to RackLine:
    + frames: FrameConfig[]   — flat canonical array of all frame positions

  Added to BayConfig:
    + widthIn: number         — explicit bay width (= all levels' beam length)

─────────────────────────────────────────────────────────────────────────────
11.  COMPATIBILITY WITH BUSINESS RULES (business_rules_racks.md)
─────────────────────────────────────────────────────────────────────────────

  Section 2.1 (Frames):    FrameConfig + RackLine.frames covers this fully.
                           frame_count = N + 1 is enforced by the module
                           coverage constraint.

  Section 2.2 (Bays):      BayConfig with widthIn and beamLevels.
                           left/right frames resolved from line.frames.

  Section 2.3 (Beams):     BeamLevelConfig.spec. Physical beam count derived
                           as beamLevels.length × 2 per bay.

  Section 2.4 (Levels):    BeamLevelConfig with levelIndex and holeIndex.

  Section 3 (Hole grid):   Enforced by holeIndex being an integer and
                           elevationIn computed as holeIndex × HOLE_STEP_IN.

  Section 5 (Min spacing): Enforced by validation rule [V5].

  Section 6 (Level order): Enforced by validation rules [V3] and [V4].

  Section 7 (Height):      Enforced by validation rule [V6].

  Section 9 (Module patterns): ModuleConfig with the coverage + continuity
                               constraints enforces |=| and |=|=| patterns.
                               The |=||=| anti-pattern is prevented because
                               modules are required to share their boundary
                               frame (consecutive modules must be adjacent).

  Section 12 (Compatibility): Enforced by validation rule [V1] and [V2].

  Section 13 (Uniformity):    isModuleBeamLevelsUniform / isLineLevelsUniform
                               are query helpers; no stored flag.

  Section 15 (Revisions):      DesignRevision unchanged. bomSnapshot is
                                cleared on each derived revision.

  Section 18 (Canvas):         The domain model is the source of truth.
                               Canvas geometry derived from:
                               - bay widths (BayConfig.widthIn)
                               - frame positions (accumulated widths)
                               - beam elevations (BeamLevelConfig.holeIndex × 2)

  Section 19 (Determinism):    Given a DesignRevision, all frame specs,
                               beam specs, bay widths, and hole indices are
                               stored explicitly. BOM derivation is fully
                               deterministic.

─────────────────────────────────────────────────────────────────────────────
12.  BEFORE / AFTER — CONCRETE OBJECT COMPARISON
─────────────────────────────────────────────────────────────────────────────

Scenario
  Single-row rack line. One module. Two bays. Two beam levels per bay.
  The user has made two customizations:
    A)  The middle frame (index 1) is changed from the default 14-gauge to
        a heavier 16-gauge, shorter frame.
    B)  The top beam level in bay 1 (right bay) is changed from the
        standard beam to a heavier beam.

Catalog facts used:
  frame-14g  = { heightIn: 144, depthIn: 42, gauge: '14', uprightSeries: 'standard' }
  frame-16g  = { heightIn: 120, depthIn: 42, gauge: '16', uprightSeries: 'standard' }
  beam-std   = { lengthIn: 96, capacityClass: 'standard', verticalEnvelopeIn: 5 }
  beam-heavy = { lengthIn: 96, capacityClass: 'heavy',    verticalEnvelopeIn: 6 }

─────────────────────────────────────────────────────────────────────────────
12.1  CURRENT MODEL (what the JS objects look like today after a customization)
─────────────────────────────────────────────────────────────────────────────

// ── RackLine ──────────────────────────────────────────────────────────────────
{
  id:               "line_1",
  modules:          [ /* see RackModule below */ ],
  rowConfiguration: "SINGLE",
  levelMode:        "VARIABLE",      // ← stored flag; can lie (problem 0.7)
  backToBackConfig: null,
  totalBayCount:    2,               // ← stored derived (problem 0.3/0.4)
  totalFrameCount:  3,               // ← stored derived (problem 0.4)
  validationState:  "VALID",
  accessoryIds:     []
}

// ── RackModule ────────────────────────────────────────────────────────────────
{
  id:             "mod_1",
  startFrameIndex: 0,
  endFrameIndex:   2,                // ← stored derived (problem 0.4)
  frameCount:      3,                // ← stored derived (problem 0.4)

  frameSpec: {                       // ← "default" for the module
    id: "frame-14g-42in-144in", heightIn: 144, depthIn: 42,
    gauge: "14", uprightSeries: "standard", basePlateType: "STANDARD"
  },

  frameOverrides: {                  // ← sparse override map (problem 0.1)
    1: {
      id: "frame-16g-42in-120in", heightIn: 120, depthIn: 42,
      gauge: "16", uprightSeries: "standard", basePlateType: "STANDARD"
    }
    // Who owns frame 2?  This module says: frameSpec (the default).
    // If a SECOND module shared frame 2, it would also have a frameOverrides[0]
    // entry. There is no rule for which one governs. (problem 0.1)
  },

  levelUnion: [                      // ← "shared" levels — already stale (problem 0.2)
    {
      id: "lvl_1", levelIndex: 0, holeIndex: 1,
      elevationIn: 2,                // ← stored derived (problem 0.4)
      beamSpec: { id: "beam-std", lengthIn: 96, verticalEnvelopeIn: 5, ... },
      isBeamSpecCustomized: false    // ← presentation flag (problem 0.3)
    },
    {
      id: "lvl_2", levelIndex: 1, holeIndex: 27,
      elevationIn: 54,               // ← stored derived (problem 0.4)
      beamSpec: { id: "beam-std", lengthIn: 96, verticalEnvelopeIn: 5, ... },
      //                             ← STALE: bay_2's level was customized to
      //                               beam-heavy, but levelUnion was not
      //                               updated. Two sources of truth. (problem 0.2)
      isBeamSpecCustomized: false
    }
  ],

  bays: [ /* bay_1 and bay_2 below */ ]
}

// ── Bay 0 (left bay — no customization) ──────────────────────────────────────
{
  id:                  "bay_1",
  leftFrameIndex:       0,           // ← stored derived (problem 0.5)
  rightFrameIndex:      1,           // ← stored derived (problem 0.5)
  beamSpec: {                        // ← ghost field (problem 0.6)
    id: "beam-std", lengthIn: 96, verticalEnvelopeIn: 5, ...
  },
  isBeamSpecCustomized: false,       // ← presentation flag (problem 0.3)
  levels: [
    {
      id: "lvl_1", levelIndex: 0, holeIndex: 1,
      elevationIn: 2,                // ← stored derived (problem 0.4)
      beamSpec: { id: "beam-std", ... },
      isBeamSpecCustomized: false    // ← presentation flag (problem 0.3)
    },
    {
      id: "lvl_2", levelIndex: 1, holeIndex: 27,
      elevationIn: 54,               // ← stored derived (problem 0.4)
      beamSpec: { id: "beam-std", ... },
      isBeamSpecCustomized: false    // ← presentation flag (problem 0.3)
    }
  ],
  accessoryIds: []
}

// ── Bay 1 (right bay — level 1 customized) ───────────────────────────────────
{
  id:                  "bay_2",
  leftFrameIndex:       1,           // ← stored derived; also: which spec does
  //                                   frame 1 use? Must trace back to
  //                                   module.frameOverrides[1]. The bay has
  //                                   no way to encode or verify this. (problem 0.5)
  rightFrameIndex:      2,           // ← stored derived (problem 0.5)
  beamSpec: {                        // ← ghost field — this is "beam-std"
    id: "beam-std", lengthIn: 96, verticalEnvelopeIn: 5, ...
  },
  isBeamSpecCustomized: false,       // ← false even though a level is customized;
  //                                   the flag gives the wrong impression (problem 0.3)
  levels: [
    {
      id: "lvl_3", levelIndex: 0, holeIndex: 1,
      elevationIn: 2,
      beamSpec: { id: "beam-std", ... },
      isBeamSpecCustomized: false
    },
    {
      id: "lvl_4", levelIndex: 1, holeIndex: 27,
      elevationIn: 54,
      beamSpec: {                    // ← correctly updated to heavy beam
        id: "beam-heavy", lengthIn: 96, verticalEnvelopeIn: 6, ...
      },
      isBeamSpecCustomized: true     // ← flag set manually; can go stale (problem 0.3)
      //                               And levelUnion[1].beamSpec is still beam-std.
      //                               Two sources of truth for bay_2 level 1. (problem 0.2)
    }
  ],
  accessoryIds: []
}

// Summary of problems visible in this one object:
//   8 stored derived values (levelMode, totalBayCount, totalFrameCount,
//     endFrameIndex, frameCount, leftFrameIndex×2, rightFrameIndex×2, elevationIn×4)
//   4 presentation flags  (isBeamSpecCustomized×4)
//   1 ghost field         (beamSpec on each bay)
//   1 stale duplicate     (levelUnion[1] diverged from bay_2.levels[1])
//   1 ambiguous ownership (frameOverrides uses local indices; boundary frames
//                          are owned by two modules simultaneously)

─────────────────────────────────────────────────────────────────────────────
12.2  NEW SCHEMA (same scenario)
─────────────────────────────────────────────────────────────────────────────

// ── RackLine ──────────────────────────────────────────────────────────────────
{
  id: "line_1",

  frames: [                          // ← flat, canonical, unambiguous
    { id: "frm_1", spec: { id: "frame-14g-42in-144in", heightIn: 144, depthIn: 42, gauge: "14", uprightSeries: "standard", basePlateType: "STANDARD" } },
    { id: "frm_2", spec: { id: "frame-16g-42in-120in", heightIn: 120, depthIn: 42, gauge: "16", uprightSeries: "standard", basePlateType: "STANDARD" } },
    { id: "frm_3", spec: { id: "frame-14g-42in-144in", heightIn: 144, depthIn: 42, gauge: "14", uprightSeries: "standard", basePlateType: "STANDARD" } }
    // frm_1 and frm_3 point to the SAME FrameSpec object (identity equality).
    // frm_2 differs — visible by simple comparison, no flag needed.
  ],

  modules: [
    {
      id:              "mod_1",
      startFrameIndex: 0,            // ← still needed to locate bays in line.frames
      bays: [

        // ── BayConfig 0 (left bay) ──────────────────────────────────────
        {
          id:      "bay_1",
          widthIn: 96,               // ← explicit bay width; validates all level specs
          beamLevels: [
            { id: "lvl_1", levelIndex: 0, holeIndex: 1,  spec: { id: "beam-std",   lengthIn: 96, verticalEnvelopeIn: 5, ... } },
            { id: "lvl_2", levelIndex: 1, holeIndex: 27, spec: { id: "beam-std",   lengthIn: 96, verticalEnvelopeIn: 5, ... } }
          ],
          accessoryIds: []
        },

        // ── BayConfig 1 (right bay — level 1 customized) ────────────────
        {
          id:      "bay_2",
          widthIn: 96,
          beamLevels: [
            { id: "lvl_3", levelIndex: 0, holeIndex: 1,  spec: { id: "beam-std",   lengthIn: 96, verticalEnvelopeIn: 5, ... } },
            { id: "lvl_4", levelIndex: 1, holeIndex: 27, spec: { id: "beam-heavy", lengthIn: 96, verticalEnvelopeIn: 6, ... } }
            // ← different spec is just the data. No flag. No duplicate in levelUnion.
            // ← frames bounding this bay: line.frames[1] and line.frames[2]
            //   resolved as:  line.frames[mod.startFrameIndex + 1]  and
            //                 line.frames[mod.startFrameIndex + 2]
          ],
          accessoryIds: []
        }

      ]
    }
  ],

  rowConfiguration: "SINGLE",
  backToBackConfig: null,
  validationState:  "VALID",
  accessoryIds:     []
}

// Derived values available on-demand (never stored):
//   elevationOf(lvl_4)              → 27 × 2 = 54"
//   bayFrames(line, modules[0], 1)  → { left: frm_2, right: frm_3 }
//   isModuleFramesUniform(line, 0)  → false  (frm_2 ≠ frm_1/frm_3)
//   isModuleBeamLevelsUniform(mod)  → false  (lvl_4 uses beam-heavy; lvl_2 uses beam-std)
//   totalBayCount                   → 2  (sum of mod.bays.length)
//   totalFrameCount                 → 3  (line.frames.length)
//   isLineLevelsUniform(line)       → false

─────────────────────────────────────────────────────────────────────────────
12.3  DIFF SUMMARY
─────────────────────────────────────────────────────────────────────────────

  Property                 CURRENT MODEL              NEW SCHEMA
  ───────────────────────  ─────────────────────────  ─────────────────────────
  Frame ownership          Module (default+overrides) RackLine.frames[]  (flat)
  Frame customization      frameOverrides{localIdx}   Replace frames[i].spec
  Shared boundary frame    Ambiguous (2 modules        Unambiguous: one entry
                           each claim it)              at index k in line.frames
  levelUnion               Stored on module            Eliminated
  Bay beam default spec    bay.beamSpec (ghost field)  Eliminated; widthIn only
  Frame indices on bay     leftFrameIndex,             Not stored; derived from
                           rightFrameIndex             module position
  Beam level flag          isBeamSpecCustomized        Eliminated; compare specs
  Frame flag               isCustomSpec                Eliminated; compare specs
  LevelMode                Stored string               Derived via query helper
  elevationIn              Stored on BeamLevel         Derived: holeIndex × 2
  endFrameIndex            Stored on Module            Derived: start + bays.len
  frameCount               Stored on Module            Derived: bays.len + 1
  totalBayCount            Stored on RackLine          Derived: sum(mod.bays.len)
  totalFrameCount          Stored on RackLine          Derived: frames.length
  "Is customized?" answer  Read the boolean flag       Compare .spec references

─────────────────────────────────────────────────────────────────────────────
13.  SCENARIO — MIXED FRAME HEIGHTS IN A THREE-MODULE LINE
─────────────────────────────────────────────────────────────────────────────

Configuration
  |=|=|=|   →   3 modules, each with 1 bay, sharing adjacent frames.

  Frame positions:
    [0]  2 m tall  (≈ 78"  →  39 holes max)
    [1]  3 m tall  (≈ 118" →  59 holes max)   ← shared boundary: modules 0 & 1
    [2]  3 m tall  (≈ 118" →  59 holes max)   ← shared boundary: modules 1 & 2
    [3]  2 m tall  (≈ 78"  →  39 holes max)

  Intent: the middle module, whose bounding frames are both 3 m, can hold
  more beam levels than the flanking modules.

─────────────────────────────────────────────────────────────────────────────
13.1  HOW THE SCHEMA REPRESENTS THIS
─────────────────────────────────────────────────────────────────────────────

  The three things the new schema handles cleanly that the old one could not:

  A.  Mixed-height frames are just independent FrameConfig entries in the
      flat line.frames[] array. No "module default + override" fiction is needed.

  B.  The shared boundary frames at positions 1 and 2 have exactly one
      FrameConfig each. Both neighbouring modules reference them by index.
      No duplication, no ambiguity about which module "owns" the frame's height.

  C.  Validation rule [V6] enforces beam height per bay by checking BOTH the
      left and right FrameConfig of that bay:

        valid_for_bay_0:   holeIndex ≤ min(39, 59)  =  39
        valid_for_bay_1:   holeIndex ≤ min(59, 59)  =  59
        valid_for_bay_2:   holeIndex ≤ min(59, 39)  =  39

      The effective ceiling for each bay is the shorter of its two frames.
      This is never stored — it is computed by the validator from the actual
      FrameConfig objects at each position.

─────────────────────────────────────────────────────────────────────────────
13.2  CONCRETE OBJECT
─────────────────────────────────────────────────────────────────────────────

  // ── Frames (two distinct specs) ─────────────────────────────────────────
  //   SPEC_2M is referenced by positions [0] and [3].
  //   SPEC_3M is referenced by positions [1] and [2].
  //   Catalog specs are shared object references, not copies.

  // Catalog entries (loaded once at startup, never copied)
  SPEC_2M = { id: "frame-14g-42in-78in",  heightIn:  78, depthIn: 42, gauge: "14", uprightSeries: "standard", basePlateType: "STANDARD" }
  SPEC_3M = { id: "frame-14g-42in-118in", heightIn: 118, depthIn: 42, gauge: "14", uprightSeries: "standard", basePlateType: "STANDARD" }

  // ── RackLine ──────────────────────────────────────────────────────────────
  {
    id: "line_1",

    frames: [
      { id: "frm_0", spec: SPEC_2M },   // position 0 — 78"  — 39 holes
      { id: "frm_1", spec: SPEC_3M },   // position 1 — 118" — 59 holes  (shared: mod_0 right / mod_1 left)
      { id: "frm_2", spec: SPEC_3M },   // position 2 — 118" — 59 holes  (shared: mod_1 right / mod_2 left)
      { id: "frm_3", spec: SPEC_2M }    // position 3 — 78"  — 39 holes
    ],
    //  frm_0 and frm_3 point to the same SPEC_2M object.
    //  frm_1 and frm_2 point to the same SPEC_3M object.
    //  The fact that frm_1 ≠ frm_0 is visible by comparing spec references.

    modules: [

      // ── Module 0: bay spanning frm_0 (78") and frm_1 (118") ─────────────
      {
        id:              "mod_0",
        startFrameIndex: 0,

        bays: [
          {
            id:      "bay_0",
            widthIn: 96,
            //  Effective height ceiling: min(39, 59) = 39 holes = 78"
            //  [V6] will reject any level with holeIndex > 39.
            beamLevels: [
              { id: "lvl_01", levelIndex: 0, holeIndex:  1, spec: BEAM_STD },  //  2"
              { id: "lvl_02", levelIndex: 1, holeIndex: 27, spec: BEAM_STD }   // 54"
              //  A third level at holeIndex 51 (102") would FAIL [V6]:
              //  51 > frameHoleCount(frm_0)=39. Correctly rejected.
            ],
            accessoryIds: []
          }
        ]
      },

      // ── Module 1: bay spanning frm_1 (118") and frm_2 (118") ────────────
      {
        id:              "mod_1",
        startFrameIndex: 1,

        bays: [
          {
            id:      "bay_1",
            widthIn: 96,
            //  Effective height ceiling: min(59, 59) = 59 holes = 118"
            //  This bay can carry a third level that the flanking bays cannot.
            beamLevels: [
              { id: "lvl_11", levelIndex: 0, holeIndex:  1, spec: BEAM_STD },  //   2"
              { id: "lvl_12", levelIndex: 1, holeIndex: 27, spec: BEAM_STD },  //  54"
              { id: "lvl_13", levelIndex: 2, holeIndex: 51, spec: BEAM_STD }   // 102" ← valid; 51 ≤ 59
            ],
            accessoryIds: []
          }
        ]
      },

      // ── Module 2: bay spanning frm_2 (118") and frm_3 (78") ─────────────
      {
        id:              "mod_2",
        startFrameIndex: 2,

        bays: [
          {
            id:      "bay_2",
            widthIn: 96,
            //  Effective height ceiling: min(59, 39) = 39 holes = 78"
            //  Symmetric to bay_0.
            beamLevels: [
              { id: "lvl_21", levelIndex: 0, holeIndex:  1, spec: BEAM_STD },  //  2"
              { id: "lvl_22", levelIndex: 1, holeIndex: 27, spec: BEAM_STD }   // 54"
            ],
            accessoryIds: []
          }
        ]
      }

    ],

    rowConfiguration: "SINGLE",
    backToBackConfig: null,
    validationState:  "VALID",
    accessoryIds:     []
  }

─────────────────────────────────────────────────────────────────────────────
13.3  DERIVED QUERIES ON THIS LINE
─────────────────────────────────────────────────────────────────────────────

  frameAt(line, 0).spec.heightIn            →  78
  frameAt(line, 1).spec.heightIn            →  118
  frameAt(line, 1) === frameAt(line, 0)     →  false  (different FrameConfig objects)
  frameAt(line, 0).spec === frameAt(line, 3).spec  →  true   (same SPEC_2M reference)

  bayFrames(line, modules[0], 0)            →  { left: frm_0, right: frm_1 }
  bayFrames(line, modules[1], 0)            →  { left: frm_1, right: frm_2 }

  // Effective hole ceiling per bay (used by validator for [V6]):
  min(frameHoleCount(frm_0), frameHoleCount(frm_1))   →  min(39, 59) = 39  (bay_0 and bay_2)
  min(frameHoleCount(frm_1), frameHoleCount(frm_2))   →  min(59, 59) = 59  (bay_1)

  isModuleFramesUniform(line, 0)            →  false  (frm_0 ≠ frm_1)
  isModuleFramesUniform(line, 1)            →  true   (frm_1 spec === frm_2 spec)
  isModuleBeamLevelsUniform(modules[0])     →  true   (only 1 bay in this module)
  isLineLevelsUniform(line)                 →  false  (bay_1 has 3 levels; bay_0/2 have 2)

  totalBayCount                             →  3   (1+1+1)
  totalFrameCount                           →  4   (line.frames.length)

─────────────────────────────────────────────────────────────────────────────
13.4  FACTORY GAP FOR THIS SCENARIO
─────────────────────────────────────────────────────────────────────────────

  The current factory shortcut `buildUniformModule(frameSpec, ...)` accepts a
  single FrameSpec for all frames in a module. That works for modules 1 and 2
  in this scenario (all their frames share the same height), but NOT for
  modules 0 and 2 where the two bounding frames have different heights.

  The factory section needs an additional pattern:

  buildMixedFrameModule(frameSpecs[], beamSpec, holeIndices, bayCount) → { frames, module }
    Each entry in frameSpecs[] is the spec for one frame position in the
    module. frameSpecs.length must equal bayCount + 1.
    The returned frames slice carries one FrameConfig per position, each
    referencing its own spec. Module coverage and [V6] validation are
    enforced as normal.

  Alternatively, modules can always be assembled directly:
    1. Construct line.frames[] manually with the desired specs.
    2. Set modules[i].startFrameIndex to point into that array.
    3. Populate each bay's beamLevels within the height constraints of its
       two bounding frames (checked by the validator).

─────────────────────────────────────────────────────────────────────────────
END OF MODEL SCHEMA
─────────────────────────────────────────────────────────────────────────────
