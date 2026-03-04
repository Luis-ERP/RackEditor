// ─────────────────────────────────────────────────────────────────────────────
//  Rack Domain Constants
//
//  All structural constants governing rack configuration business rules.
//  Reference: business_rules_racks.md
// ─────────────────────────────────────────────────────────────────────────────

/** Hole spacing on frame uprights, in inches. (Section 3) */
export const HOLE_STEP_IN = 2;

/** Minimum bay count per rack line. (Section 11) */
export const MIN_BAY_COUNT = 1;

/** Safety pins per beam. (Section 10.1) */
export const SAFETY_PINS_PER_BEAM = 2;

/** Number of beams per level per bay (left + right pair). (Section 2.3) */
export const BEAMS_PER_LEVEL = 2;

// ── Validation States (Section 14) ──────────────────────────────────────────

export const ValidationState = Object.freeze({
  INCOMPLETE:          'INCOMPLETE',
  VALID:               'VALID',
  VALID_WITH_WARNINGS: 'VALID_WITH_WARNINGS',
  INVALID:             'INVALID',
});

// ── Row Configuration Types (Section 9) ─────────────────────────────────────

export const RowConfiguration = Object.freeze({
  SINGLE:          'SINGLE',
  BACK_TO_BACK_2:  'BACK_TO_BACK_2',
  BACK_TO_BACK_3:  'BACK_TO_BACK_3',
  BACK_TO_BACK_4:  'BACK_TO_BACK_4',
});

// ── Level Configuration Modes (Section 13) ──────────────────────────────────

export const LevelMode = Object.freeze({
  UNIFORM:  'UNIFORM',
  VARIABLE: 'VARIABLE',
});

// ── Accessory Scope ─────────────────────────────────────────────────────────

export const AccessoryScope = Object.freeze({
  RACK_LINE: 'RACK_LINE',
  BAY:       'BAY',
  LEVEL:     'LEVEL',
});

// ── Accessory Category (Section 10) ─────────────────────────────────────────

export const AccessoryCategory = Object.freeze({
  DERIVED:  'DERIVED',
  EXPLICIT: 'EXPLICIT',
});

// ── Base Plate Types ────────────────────────────────────────────────────────

export const BasePlateType = Object.freeze({
  STANDARD: 'STANDARD',       // 2 anchors
  HEAVY_DUTY: 'HEAVY_DUTY',   // 4 anchors
});

/** Anchors per frame by base plate type. (Section 10.1) */
export const ANCHORS_PER_FRAME = Object.freeze({
  [BasePlateType.STANDARD]:   2,
  [BasePlateType.HEAVY_DUTY]: 4,
});
