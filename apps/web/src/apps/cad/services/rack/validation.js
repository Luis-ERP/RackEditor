// ─────────────────────────────────────────────────────────────────────────────
//  Validation Engine
//
//  Validates rack line configurations against all business rules and produces
//  structured validation results with errors and warnings.
//
//  Reference: business_rules_racks.md — Sections 2.1, 2.4, 3–9, 12–14
// ─────────────────────────────────────────────────────────────────────────────

import { ValidationState, HOLE_STEP_IN, RowConfiguration, CAPACITY_CLASS_RANK } from './constants.js';
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
 * hole_index must be a non-negative integer.
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
 * Rule: levelIndex values must be consecutive integers starting at 0. (Section 2.4)
 * Valid: {0, 1, 2}. Invalid: {0, 2, 5} or {1, 2, 3}.
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @returns {ValidationError[]}
 */
function validateLevelIndexConsecutive(levels) {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a.levelIndex - b.levelIndex);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].levelIndex !== i) {
      return [{
        code: 'LEVEL_INDEX_NOT_CONSECUTIVE',
        message: `Level indices must be consecutive integers starting at 0. Expected index ${i}, found ${sorted[i].levelIndex}.`,
        severity: 'error',
        context: { expectedIndex: i, actualIndex: sorted[i].levelIndex },
      }];
    }
  }
  return [];
}

/**
 * Rule: Beam levels must not exceed frame height minus minimum top clearance. (Section 7)
 *
 * top_beam_elevation ≤ frame_height − minimumTopClearanceIn
 *
 * Violating either the hard height limit or the top clearance is a blocking INVALID error.
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @param {import('./models/frame.js').FrameSpec}  frameSpec
 * @returns {ValidationError[]}
 */
function validateFrameHeightConstraint(levels, frameSpec) {
  const errors = [];
  const maxHole = maxHoleIndex(frameSpec);
  const minimumTopClearanceIn = frameSpec.minimumTopClearanceIn;
  const maxAllowedElevation = frameSpec.heightIn - minimumTopClearanceIn;

  for (const level of levels) {
    if (level.holeIndex > maxHole) {
      errors.push({
        code: 'LEVEL_EXCEEDS_FRAME_HEIGHT',
        message: `Level ${level.levelIndex}: holeIndex ${level.holeIndex} exceeds max hole index ${maxHole} for frame height ${frameSpec.heightIn}".`,
        severity: 'error',
        context: { levelIndex: level.levelIndex, holeIndex: level.holeIndex, maxHole },
      });
    } else if (minimumTopClearanceIn > 0 && level.elevationIn > maxAllowedElevation) {
      errors.push({
        code: 'INSUFFICIENT_TOP_CLEARANCE',
        message: `Level ${level.levelIndex}: elevation ${level.elevationIn}" exceeds max allowed ${maxAllowedElevation}" (frame height ${frameSpec.heightIn}" − top clearance ${minimumTopClearanceIn}").`,
        severity: 'error',
        context: { levelIndex: level.levelIndex, elevationIn: level.elevationIn, maxAllowedElevation, minimumTopClearanceIn },
      });
    }
  }
  return errors;
}

/**
 * Rule: Minimum floor clearance for first beam level. (Section 8.1)
 *
 * first_beam_elevation ≥ minimum_floor_clearance_in
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
 * Rule: First beam connector must not penetrate below floor grade. (Section 8.2)
 *
 * first_beam_elevation ≥ first_beam.beam_vertical_envelope_in
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @returns {ValidationError[]}
 */
function validateConnectorAboveGrade(levels) {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a.holeIndex - b.holeIndex);
  const firstLevel = sorted[0];

  if (firstLevel.elevationIn < firstLevel.beamSpec.verticalEnvelopeIn) {
    return [{
      code: 'CONNECTOR_BELOW_GRADE',
      message: `First beam level elevation (${firstLevel.elevationIn}") is less than its connector envelope (${firstLevel.beamSpec.verticalEnvelopeIn}"). Connector hardware would penetrate below floor.`,
      severity: 'error',
      context: {
        levelIndex: firstLevel.levelIndex,
        elevationIn: firstLevel.elevationIn,
        envelopeIn: firstLevel.beamSpec.verticalEnvelopeIn,
      },
    }];
  }
  return [];
}

/**
 * Rule: Beam connector type must be in frame's compatible connector types. (Section 12.1)
 *
 * beam.connectorType ∈ frame.compatibleConnectorTypes
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @param {import('./models/frame.js').FrameSpec}  frameSpec
 * @returns {ValidationError[]}
 */
function validateConnectorType(levels, frameSpec) {
  const errors = [];
  for (const level of levels) {
    if (!frameSpec.compatibleConnectorTypes.includes(level.beamSpec.connectorType)) {
      errors.push({
        code: 'CONNECTOR_TYPE_MISMATCH',
        message: `Level ${level.levelIndex}: beam connector type "${level.beamSpec.connectorType}" is not compatible with frame. Allowed: [${frameSpec.compatibleConnectorTypes.join(', ')}].`,
        severity: 'error',
        context: {
          levelIndex: level.levelIndex,
          connectorType: level.beamSpec.connectorType,
          compatibleConnectorTypes: frameSpec.compatibleConnectorTypes,
        },
      });
    }
  }
  return errors;
}

/**
 * Rule: Beam capacity class must not exceed frame's allowable capacity class. (Section 12.2)
 *
 * beamCapacityClass ≤ frameAllowableCapacityClass
 *
 * Uses CAPACITY_CLASS_RANK for ordered comparison. If either rank is unknown,
 * the check is skipped (no information to validate against).
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @param {import('./models/frame.js').FrameSpec}  frameSpec
 * @returns {ValidationError[]}
 */
function validateCapacityClass(levels, frameSpec) {
  const errors = [];
  const frameRank = CAPACITY_CLASS_RANK[(frameSpec.capacityClass || '').toUpperCase()];
  if (frameRank == null) return []; // Unknown frame class; cannot compare

  for (const level of levels) {
    const beamRank = CAPACITY_CLASS_RANK[(level.beamSpec.capacityClass || '').toUpperCase()];
    if (beamRank == null) continue; // Unknown beam class; skip

    if (beamRank > frameRank) {
      errors.push({
        code: 'CAPACITY_CLASS_EXCEEDED',
        message: `Level ${level.levelIndex}: beam capacity class "${level.beamSpec.capacityClass}" exceeds frame allowable class "${frameSpec.capacityClass}". Upright would be underspecified for the load.`,
        severity: 'error',
        context: {
          levelIndex: level.levelIndex,
          beamCapacityClass: level.beamSpec.capacityClass,
          frameCapacityClass: frameSpec.capacityClass,
        },
      });
    }
  }
  return errors;
}

/**
 * Rule: Beam must be compatible with frame upright series. (Section 12.4)
 *
 * beam.compatibleUprightSeries.includes(frame.uprightSeries)
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
        message: `Level ${level.levelIndex}: beam "${level.beamSpec.id}" is not compatible with upright series "${uprightSeries}".`,
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
 * Rule: Beam length must match bay width. (Section 12.3)
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
 * Rule: Frame depth must be uniform within the rack line for single-row configurations,
 * and uniform within each row for back-to-back configurations. (Section 2.1, 9.2.3)
 *
 * All resolved FrameSpecs (including per-frame overrides) must share the same depthIn.
 * For back-to-back lines with rowIndex annotations on modules, depth uniformity is
 * enforced per rowIndex group.
 *
 * @param {import('./models/rackLine.js').RackLine} rackLine
 * @returns {ValidationError[]}
 */
function validateFrameDepthUniformity(rackLine) {
  const errors = [];

  if (rackLine.rowConfiguration === RowConfiguration.SINGLE) {
    // All frame depths in all modules must match
    const depths = new Set();
    for (const mod of rackLine.modules) {
      depths.add(mod.frameSpec.depthIn);
      for (const override of Object.values(mod.frameOverrides)) {
        depths.add(override.depthIn);
      }
    }
    if (depths.size > 1) {
      errors.push({
        code: 'FRAME_DEPTH_NOT_UNIFORM',
        message: `Frame depths are not uniform within the rack line. Found depths: ${[...depths].join(', ')} inches.`,
        severity: 'error',
        context: { depths: [...depths] },
      });
    }
  } else {
    // Back-to-back: enforce uniformity per rowIndex group (for modules that declare rowIndex)
    const depthsByRow = new Map(); // rowIndex → Set of depths

    for (const mod of rackLine.modules) {
      if (mod.rowIndex == null) continue; // Skip unassigned modules

      if (!depthsByRow.has(mod.rowIndex)) {
        depthsByRow.set(mod.rowIndex, new Set());
      }
      const rowDepths = depthsByRow.get(mod.rowIndex);
      rowDepths.add(mod.frameSpec.depthIn);
      for (const override of Object.values(mod.frameOverrides)) {
        rowDepths.add(override.depthIn);
      }
    }

    for (const [rowIdx, depths] of depthsByRow) {
      if (depths.size > 1) {
        errors.push({
          code: 'FRAME_DEPTH_NOT_UNIFORM',
          message: `Frame depths are not uniform within row ${rowIdx}. Found depths: ${[...depths].join(', ')} inches.`,
          severity: 'error',
          context: { rowIndex: rowIdx, depths: [...depths] },
        });
      }
    }
  }

  return errors;
}

/**
 * Rule: Row spacer size must meet minimum. (Section 9.2.5)
 *
 * row_spacer_size ≥ minimum_row_spacer_in
 *
 * Only checked when minimumRowSpacerIn > 0 (catalog-defined minimum must be provided
 * as a validation option).
 *
 * @param {import('./models/rackLine.js').RackLine} rackLine
 * @param {number} minimumRowSpacerIn
 * @returns {ValidationError[]}
 */
function validateRowSpacerSize(rackLine, minimumRowSpacerIn) {
  if (minimumRowSpacerIn <= 0) return [];
  if (rackLine.rowConfiguration === RowConfiguration.SINGLE) return [];
  if (!rackLine.backToBackConfig) return [];

  if (rackLine.backToBackConfig.rowSpacerSizeIn < minimumRowSpacerIn) {
    return [{
      code: 'ROW_SPACER_TOO_SMALL',
      message: `Row spacer size (${rackLine.backToBackConfig.rowSpacerSizeIn}") is below the catalog minimum (${minimumRowSpacerIn}").`,
      severity: 'error',
      context: {
        rowSpacerSizeIn: rackLine.backToBackConfig.rowSpacerSizeIn,
        minimumRowSpacerIn,
      },
    }];
  }
  return [];
}

/**
 * Rule: In back-to-back rack lines, every module must declare its rowIndex. (Section 9.2.2, 9.2.4)
 *
 * @param {import('./models/rackLine.js').RackLine} rackLine
 * @returns {ValidationError[]}
 */
function validateModuleRowMembership(rackLine) {
  if (rackLine.rowConfiguration === RowConfiguration.SINGLE) return [];

  const errors = [];
  for (let i = 0; i < rackLine.modules.length; i++) {
    const mod = rackLine.modules[i];
    if (mod.rowIndex == null) {
      errors.push({
        code: 'MODULE_ROW_UNASSIGNED',
        message: `Module ${i} (id: ${mod.id}) does not declare rowIndex. Back-to-back rack lines require all modules to have a rowIndex annotation. (Section 9.2.2)`,
        severity: 'error',
        context: { moduleIndex: i, moduleId: mod.id },
      });
    }
  }
  return errors;
}

/**
 * Check for informational warning conditions. (Section 14)
 *
 * @param {import('./models/beam.js').BeamLevel[]} levels
 * @param {import('./models/frame.js').FrameSpec}  frameSpec
 * @returns {ValidationError[]}
 */
function checkWarnings(levels, frameSpec) {
  const warnings = [];
  const sorted = [...levels].sort((a, b) => a.holeIndex - b.holeIndex);

  // Warn if top beam is within 4 inches of the frame top (but still within clearance limit)
  if (sorted.length > 0) {
    const topLevel = sorted[sorted.length - 1];
    const remaining = frameSpec.heightIn - topLevel.elevationIn;
    if (remaining > 0 && remaining <= 4) {
      warnings.push({
        code: 'NEAR_FRAME_TOP',
        message: `Top beam level is only ${remaining}" below the frame top. Consider safety clearance.`,
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
 * @param {number} [options.minimumFloorClearanceIn=0]  - Section 8.1 (catalog-defined)
 * @param {number} [options.minimumRowSpacerIn=0]        - Section 9.2.5 (catalog-defined)
 * @returns {ValidationResult}
 */
export function validateRackLine(rackLine, options = {}) {
  const {
    minimumFloorClearanceIn = 0,
    minimumRowSpacerIn = 0,
  } = options;

  const allErrors = [];
  const allWarnings = [];
  const allBays = rackLineAllBays(rackLine);

  // Section 9.2.5: Row spacer minimum
  allErrors.push(...validateRowSpacerSize(rackLine, minimumRowSpacerIn));

  // Section 9.2.2 / 9.2.4: Module row membership annotation in back-to-back
  allErrors.push(...validateModuleRowMembership(rackLine));

  // Section 2.1 / 9.2.3: Frame depth uniformity
  allErrors.push(...validateFrameDepthUniformity(rackLine));

  // Validate each module
  for (const mod of rackLine.modules) {
    const levels = mod.levelUnion;
    const frameSpec = mod.frameSpec;

    // Section 3: Hole grid alignment
    allErrors.push(...validateHoleGridAlignment(levels));

    // Section 2.4: levelIndex consecutive from 0
    allErrors.push(...validateLevelIndexConsecutive(levels));

    // Sections 5, 6: Minimum spacing & strict ordering
    allErrors.push(...validateMinimumVerticalSpacing(levels));

    // Section 7: Frame height + top clearance (blocking error)
    allErrors.push(...validateFrameHeightConstraint(levels, frameSpec));

    // Section 8.1: Floor clearance
    allErrors.push(...validateFloorClearance(levels, minimumFloorClearanceIn));

    // Section 8.2: Connector above grade
    allErrors.push(...validateConnectorAboveGrade(levels));

    // Section 12.1: Connector type compatibility
    allErrors.push(...validateConnectorType(levels, frameSpec));

    // Section 12.2: Capacity class constraint (beam ≤ frame)
    allErrors.push(...validateCapacityClass(levels, frameSpec));

    // Section 12.4: Beam upright series compatibility
    allErrors.push(...validateBeamFrameCompatibility(levels, frameSpec.uprightSeries));

    // Warnings
    allWarnings.push(...checkWarnings(levels, frameSpec));
  }

  // Section 12.3: Beam length matches bay width
  allErrors.push(...validateBeamLengthMatch(allBays));

  // Completeness check: a line with no beam levels in any module is INCOMPLETE
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
