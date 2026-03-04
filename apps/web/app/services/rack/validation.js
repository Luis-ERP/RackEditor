// ─────────────────────────────────────────────────────────────────────────────
//  Validation Engine
//
//  Validates rack line configurations against all business rules and produces
//  structured validation results with errors and warnings.
//
//  Reference: business_rules_racks.md — Sections 3–8, 12–14
// ─────────────────────────────────────────────────────────────────────────────

import { ValidationState, HOLE_STEP_IN } from './constants.js';
import { maxHoleIndex } from './models/frame.js';
import {
  validateLevelSpacing,
  isBeamCompatibleWithFrame,
} from './models/beam.js';
import { validateBayBeamLength } from './models/bay.js';
import { rackLineAllBays } from './models/rackLine.js';

/**
 * @typedef {Object} ValidationError
 * @property {string}  code     - Machine-readable error code
 * @property {string}  message  - Human-readable description
 * @property {string}  severity - 'error' | 'warning'
 * @property {Object}  [context] - Additional context (bay id, level index, etc.)
 */

/**
 * @typedef {Object} ValidationResult
 * @property {string}            state    - ValidationState enum value
 * @property {ValidationError[]} errors   - Blocking errors
 * @property {ValidationError[]} warnings - Non-blocking warnings
 */

// ── Individual Rule Validators ──────────────────────────────────────────────

/**
 * Rule: All beam levels must align to the hole grid. (Section 3)
 * hole_index must be an integer.
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @returns {ValidationError[]}
 */
function validateHoleGridAlignment(levels) {
  const errors = [];
  for (const level of levels) {
    if (!Number.isInteger(level.holeIndex) || level.holeIndex < 0) {
      errors.push({
        code: 'HOLE_GRID_MISALIGNED',
        message: `Level ${level.levelIndex}: holeIndex (${level.holeIndex}) is not a valid non-negative integer.`,
        severity: 'error',
        context: { levelIndex: level.levelIndex, holeIndex: level.holeIndex },
      });
    }
  }
  return errors;
}

/**
 * Rule: Beam levels must not exceed frame height. (Section 7)
 * top_beam_elevation ≤ frame_height
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @param {import('./models/frame.js').FrameSpec}  frameSpec
 * @param {number} [minimumTopClearanceIn=0] - Optional safety clearance
 * @returns {ValidationError[]}
 */
function validateFrameHeightConstraint(levels, frameSpec, minimumTopClearanceIn = 0) {
  const errors = [];
  const maxHole = maxHoleIndex(frameSpec);
  const maxElevation = frameSpec.heightIn - minimumTopClearanceIn;

  for (const level of levels) {
    if (level.holeIndex > maxHole) {
      errors.push({
        code: 'LEVEL_EXCEEDS_FRAME_HEIGHT',
        message: `Level ${level.levelIndex}: holeIndex ${level.holeIndex} exceeds max hole index ${maxHole} for frame height ${frameSpec.heightIn}".`,
        severity: 'error',
        context: { levelIndex: level.levelIndex, holeIndex: level.holeIndex, maxHole },
      });
    }
    if (minimumTopClearanceIn > 0 && level.elevationIn > maxElevation) {
      errors.push({
        code: 'INSUFFICIENT_TOP_CLEARANCE',
        message: `Level ${level.levelIndex}: elevation ${level.elevationIn}" exceeds max allowed ${maxElevation}" (top clearance: ${minimumTopClearanceIn}").`,
        severity: 'warning',
        context: { levelIndex: level.levelIndex, elevationIn: level.elevationIn, maxElevation },
      });
    }
  }
  return errors;
}

/**
 * Rule: Minimum floor clearance for first beam level. (Section 8)
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @param {number} minimumFloorClearanceIn
 * @returns {ValidationError[]}
 */
function validateFloorClearance(levels, minimumFloorClearanceIn) {
  if (minimumFloorClearanceIn <= 0 || levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a.holeIndex - b.holeIndex);
  const firstLevel = sorted[0];

  if (firstLevel.elevationIn < minimumFloorClearanceIn) {
    return [{
      code: 'INSUFFICIENT_FLOOR_CLEARANCE',
      message: `First beam level elevation (${firstLevel.elevationIn}") is below minimum floor clearance (${minimumFloorClearanceIn}").`,
      severity: 'error',
      context: {
        levelIndex: firstLevel.levelIndex,
        elevationIn: firstLevel.elevationIn,
        minimumFloorClearanceIn,
      },
    }];
  }
  return [];
}

/**
 * Rule: Beam must be compatible with frame upright series. (Section 12)
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @param {string} uprightSeries
 * @returns {ValidationError[]}
 */
function validateBeamFrameCompatibility(levels, uprightSeries) {
  const errors = [];
  for (const level of levels) {
    if (!isBeamCompatibleWithFrame(level.beamSpec, uprightSeries)) {
      errors.push({
        code: 'BEAM_INCOMPATIBLE_WITH_FRAME',
        message: `Level ${level.levelIndex}: beam "${level.beamSpec.id}" (connector: ${level.beamSpec.connectorType}) is not compatible with upright series "${uprightSeries}".`,
        severity: 'error',
        context: {
          levelIndex: level.levelIndex,
          beamId: level.beamSpec.id,
          uprightSeries,
        },
      });
    }
  }
  return errors;
}

/**
 * Rule: Beam length must match bay width. (Section 12)
 *
 * @param {import('./models/bay.js').Bay[]} bays
 * @returns {ValidationError[]}
 */
function validateBeamLengthMatch(bays) {
  const errors = [];
  for (const bay of bays) {
    const result = validateBayBeamLength(bay);
    if (!result.valid) {
      errors.push({
        code: 'BEAM_LENGTH_MISMATCH',
        message: result.message,
        severity: 'error',
        context: { bayId: bay.id },
      });
    }
  }
  return errors;
}

/**
 * Rule: Minimum vertical spacing between beam levels. (Sections 5, 6)
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @returns {ValidationError[]}
 */
function validateMinimumVerticalSpacing(levels) {
  const spacingIssues = validateLevelSpacing(levels);
  return spacingIssues.map((issue) => ({
    code: 'LEVELS_TOO_CLOSE',
    message: issue.message,
    severity: 'error',
    context: { levelIndex: issue.levelIndex },
  }));
}

/**
 * Check for near-capacity or non-standard spacing conditions. (Section 14)
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @param {import('./models/frame.js').FrameSpec}  frameSpec
 * @returns {ValidationError[]}
 */
function checkWarnings(levels, frameSpec) {
  const warnings = [];
  const sorted = [...levels].sort((a, b) => a.holeIndex - b.holeIndex);

  // Warn if very close to frame top (within 4 inches)
  if (sorted.length > 0) {
    const topLevel = sorted[sorted.length - 1];
    const remaining = frameSpec.heightIn - topLevel.elevationIn;
    if (remaining > 0 && remaining <= 4) {
      warnings.push({
        code: 'NEAR_FRAME_TOP',
        message: `Top beam level is only ${remaining}" below frame top. Consider safety clearance.`,
        severity: 'warning',
        context: { levelIndex: topLevel.levelIndex, remainingIn: remaining },
      });
    }
  }

  return warnings;
}

// ── Main Validation Orchestrator ────────────────────────────────────────────

/**
 * Validate an entire rack line against all business rules.
 *
 * @param {import('./models/rackLine.js').RackLine} rackLine
 * @param {Object} [options]
 * @param {number} [options.minimumFloorClearanceIn=0]
 * @param {number} [options.minimumTopClearanceIn=0]
 * @returns {ValidationResult}
 */
export function validateRackLine(rackLine, options = {}) {
  const {
    minimumFloorClearanceIn = 0,
    minimumTopClearanceIn = 0,
  } = options;

  const allErrors = [];
  const allWarnings = [];
  const allBays = rackLineAllBays(rackLine);

  // Validate each module
  for (const mod of rackLine.modules) {
    const levels = mod.levelUnion;
    const frameSpec = mod.frameSpec;

    // Section 3: Hole grid alignment
    allErrors.push(...validateHoleGridAlignment(levels));

    // Sections 5, 6: Minimum spacing & strict ordering
    allErrors.push(...validateMinimumVerticalSpacing(levels));

    // Section 7: Frame height constraints
    const heightResults = validateFrameHeightConstraint(levels, frameSpec, minimumTopClearanceIn);
    for (const r of heightResults) {
      if (r.severity === 'error') allErrors.push(r);
      else allWarnings.push(r);
    }

    // Section 8: Floor clearance
    allErrors.push(...validateFloorClearance(levels, minimumFloorClearanceIn));

    // Section 12: Beam-frame compatibility
    allErrors.push(...validateBeamFrameCompatibility(levels, frameSpec.uprightSeries));

    // Warnings
    allWarnings.push(...checkWarnings(levels, frameSpec));
  }

  // Section 12: Beam length matches bay width
  allErrors.push(...validateBeamLengthMatch(allBays));

  // Completeness check: a line with no modules or empty levels is INCOMPLETE
  const hasLevels = rackLine.modules.some((m) => m.levelUnion.length > 0);
  if (!hasLevels) {
    return {
      state: ValidationState.INCOMPLETE,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  // Determine final state (Section 14)
  if (allErrors.length > 0) {
    return {
      state: ValidationState.INVALID,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  if (allWarnings.length > 0) {
    return {
      state: ValidationState.VALID_WITH_WARNINGS,
      errors: [],
      warnings: allWarnings,
    };
  }

  return {
    state: ValidationState.VALID,
    errors: [],
    warnings: [],
  };
}

/**
 * Validate a complete design revision (all rack lines).
 *
 * @param {import('./models/designRevision.js').DesignRevision} revision
 * @param {Object} [options]
 * @returns {{ overallState: string, lineResults: Map<string, ValidationResult> }}
 */
export function validateDesignRevision(revision, options = {}) {
  const lineResults = new Map();
  let hasErrors = false;
  let hasWarnings = false;

  for (const line of revision.rackLines) {
    const result = validateRackLine(line, options);
    lineResults.set(line.id, result);

    if (result.state === ValidationState.INVALID) hasErrors = true;
    if (result.state === ValidationState.VALID_WITH_WARNINGS) hasWarnings = true;
    if (result.state === ValidationState.INCOMPLETE) hasErrors = true;
  }

  let overallState;
  if (revision.rackLines.length === 0) {
    overallState = ValidationState.INCOMPLETE;
  } else if (hasErrors) {
    overallState = ValidationState.INVALID;
  } else if (hasWarnings) {
    overallState = ValidationState.VALID_WITH_WARNINGS;
  } else {
    overallState = ValidationState.VALID;
  }

  return { overallState, lineResults };
}
