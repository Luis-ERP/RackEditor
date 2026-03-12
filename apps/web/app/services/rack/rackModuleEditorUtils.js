// ─────────────────────────────────────────────────────────────────────────────
//  Rack Module Editor Utilities
//
//  Pure domain-layer helper functions used by the RackModuleEditor UI.
//  No React, no side effects — all functions are deterministic and testable.
// ─────────────────────────────────────────────────────────────────────────────

import { HOLE_STEP_IN, RowConfiguration, LevelMode } from './constants.js';
import { minimumGapSteps }                            from './models/beam.js';
import { maxHoleIndex }                               from './models/frame.js';
import { createBeamLevel }                            from './models/beam.js';
import { createBay }                                  from './models/bay.js';
import { createRackModule }                           from './models/rackModule.js';
import { createRackLine }                             from './models/rackLine.js';
import { validateRackLine }                           from './validation.js';
import { INCH_TO_M, FRAME_WIDTH_M }                   from './catalog.js';

// ── ID Generator (editor-scoped, distinct from factory IDs) ──────────────────
let _counter = 0;
function eid(prefix) { return `${prefix}_e${++_counter}`; }

// ── Dimension helpers ─────────────────────────────────────────────────────────

/**
 * Compute entity widthM and depthM from beam/frame specs and bay count.
 * Used to update the layout entity when the editor changes specs.
 *
 * @param {import('./models/beam.js').BeamSpec}  beamSpec
 * @param {import('./models/frame.js').FrameSpec} frameSpec
 * @param {number} bayCount
 * @returns {{ widthM: number, depthM: number }}
 */
export function computeEntityDimensions(beamSpec, frameSpec, bayCount) {
  const bayStepM = beamSpec.lengthIn * INCH_TO_M - FRAME_WIDTH_M;
  const widthM   = bayCount * bayStepM + FRAME_WIDTH_M;
  const depthM   = frameSpec.depthIn * INCH_TO_M;
  return { widthM, depthM };
}

// ── Hole position helpers ─────────────────────────────────────────────────────

/**
 * Maximum hole index allowed by the frame height constraint (Section 7).
 * Accounts for minimum top clearance.
 *
 * @param {import('./models/frame.js').FrameSpec} frameSpec
 * @returns {number}
 */
export function maxAllowedHoleIndex(frameSpec) {
  const maxHole       = maxHoleIndex(frameSpec);
  const clearanceHoles = Math.ceil(frameSpec.minimumTopClearanceIn / HOLE_STEP_IN);
  return Math.max(0, maxHole - clearanceHoles);
}

/**
 * Find the next valid hole index for a new level added above all existing levels.
 * Returns null if there is no room in the frame.
 *
 * @param {number[]} holeIndices - Existing hole indices (may be empty)
 * @param {import('./models/frame.js').FrameSpec} frameSpec
 * @param {import('./models/beam.js').BeamSpec}   beamSpec
 * @returns {number|null}
 */
export function autoPositionNewLevel(holeIndices, frameSpec, beamSpec) {
  const maxAllowed = maxAllowedHoleIndex(frameSpec);
  const minGap     = minimumGapSteps(beamSpec, beamSpec);

  if (holeIndices.length === 0) {
    // Place at hole 1 (elevation 2") if it fits — satisfies above-grade rule for most beams.
    return maxAllowed >= 1 ? 1 : null;
  }

  const sorted    = [...holeIndices].sort((a, b) => a - b);
  const topHole   = sorted[sorted.length - 1];
  const candidate = topHole + minGap;
  return candidate <= maxAllowed ? candidate : null;
}

/**
 * Clamp hole indices to remain within the frame height after a frame spec change.
 * Indices that exceed the new max are removed. The remaining indices are re-checked
 * for minimum spacing — indices that violate spacing are also removed (bottom-up).
 *
 * @param {number[]} holeIndices
 * @param {import('./models/frame.js').FrameSpec} newFrameSpec
 * @param {import('./models/beam.js').BeamSpec}   beamSpec
 * @returns {number[]} Adjusted, still-sorted hole indices
 */
export function clampHoleIndicesToFrame(holeIndices, newFrameSpec, beamSpec) {
  const maxAllowed = maxAllowedHoleIndex(newFrameSpec);
  const minGap     = minimumGapSteps(beamSpec, beamSpec);

  // Remove any that exceed the new max
  const filtered = [...holeIndices].sort((a, b) => a - b).filter((h) => h <= maxAllowed);

  // Remove spacing violations (keep lower levels, drop violating upper level)
  const kept = [];
  for (const h of filtered) {
    if (kept.length === 0) {
      kept.push(h);
    } else if (h - kept[kept.length - 1] >= minGap) {
      kept.push(h);
    }
    // If spacing is violated, drop h silently
  }
  return kept;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Run business-rule validation on a draft state.
 * Builds a temporary single-module RackLine and calls validateRackLine.
 *
 * @param {{ frameSpec, beamSpec, holeIndices, bayCount, rowConfiguration, spacerSizeIn }} draft
 * @returns {import('./validation.js').ValidationResult}
 */
export function computeDraftValidation(draft) {
  const {
    frameSpec,
    beamSpec,
    holeIndices,
    bayCount      = 1,
    rowConfiguration = RowConfiguration.SINGLE,
    spacerSizeIn  = 6,
  } = draft;

  if (!frameSpec || !beamSpec) {
    return {
      state: 'INCOMPLETE',
      errors: [],
      warnings: [],
    };
  }

  // Build beam levels (may be empty → INCOMPLETE)
  let levelUnion = [];
  if (holeIndices.length > 0) {
    const sorted = [...holeIndices].sort((a, b) => a - b);
    levelUnion = sorted.map((holeIndex, i) =>
      createBeamLevel({
        id:         eid('lvl'),
        levelIndex: i,
        holeIndex,
        beamSpec,
      }),
    );
  }

  // Build bays
  const bays = [];
  for (let i = 0; i < bayCount; i++) {
    bays.push(createBay({
      id:             eid('bay'),
      leftFrameIndex: i,
      beamSpec,
      levels:         levelUnion,
    }));
  }

  // Build module
  let mod;
  try {
    mod = createRackModule({
      id:             eid('mod'),
      frameSpec,
      bays,
      levelUnion,
      startFrameIndex: 0,
      rowIndex:       rowConfiguration !== RowConfiguration.SINGLE ? 0 : null,
    });
  } catch {
    return {
      state: 'INVALID',
      errors: [{
        code:     'FACTORY_ERROR',
        message:  'Invalid module configuration.',
        severity: 'error',
        context:  {},
      }],
      warnings: [],
    };
  }

  // Build rack line
  let line;
  try {
    const backToBackConfig = rowConfiguration !== RowConfiguration.SINGLE
      ? { rowSpacerSizeIn: spacerSizeIn }
      : null;

    line = createRackLine({
      id:               eid('line'),
      modules:          [mod],
      rowConfiguration,
      levelMode:        LevelMode.UNIFORM,
      backToBackConfig,
    });
  } catch {
    return {
      state: 'INVALID',
      errors: [{
        code:     'LINE_CONFIG_ERROR',
        message:  'Invalid rack line configuration.',
        severity: 'error',
        context:  {},
      }],
      warnings: [],
    };
  }

  return validateRackLine(line, {
    minimumFloorClearanceIn: 0,
    minimumRowSpacerIn:      rowConfiguration !== RowConfiguration.SINGLE ? 3 : 0,
  });
}

// ── Draft mutation helpers ────────────────────────────────────────────────────

/**
 * Produce a new draft with a different frame spec applied.
 * Clamps hole indices to remain within the new frame's valid range.
 *
 * @param {Object} draft
 * @param {import('./models/frame.js').FrameSpec} newFrameSpec
 * @returns {Object} New draft
 */
export function applyFrameSpec(draft, newFrameSpec) {
  const clamped = clampHoleIndicesToFrame(draft.holeIndices, newFrameSpec, draft.beamSpec);
  return { ...draft, frameSpec: newFrameSpec, holeIndices: clamped };
}

/**
 * Produce a new draft with a different beam spec applied.
 * Re-validates and removes spacing violations caused by the new envelope.
 *
 * @param {Object} draft
 * @param {import('./models/beam.js').BeamSpec} newBeamSpec
 * @returns {Object} New draft
 */
export function applyBeamSpec(draft, newBeamSpec) {
  const clamped = clampHoleIndicesToFrame(draft.holeIndices, draft.frameSpec, newBeamSpec);
  return { ...draft, beamSpec: newBeamSpec, holeIndices: clamped };
}

/**
 * Add a new beam level at the next valid position above the highest existing level.
 * Returns the unchanged draft if there is no room.
 *
 * @param {Object} draft
 * @returns {Object} New draft
 */
export function addLevel(draft) {
  const next = autoPositionNewLevel(draft.holeIndices, draft.frameSpec, draft.beamSpec);
  if (next === null) return draft;
  return { ...draft, holeIndices: [...draft.holeIndices, next].sort((a, b) => a - b) };
}

/**
 * Remove the level at the given sorted index (0-based within the sorted holeIndices array).
 *
 * @param {Object} draft
 * @param {number} levelIndex - 0-based index in sorted holeIndices
 * @returns {Object} New draft
 */
export function removeLevel(draft, levelIndex) {
  const sorted  = [...draft.holeIndices].sort((a, b) => a - b);
  const newHoles = sorted.filter((_, i) => i !== levelIndex);
  return { ...draft, holeIndices: newHoles };
}

/**
 * Move a beam level to a new hole index.
 * The new index is clamped to the valid range for the frame.
 * If the new position would violate spacing with adjacent levels, the closest
 * valid hole is used. Returns the unchanged draft if the move is not possible.
 *
 * @param {Object} draft
 * @param {number} levelIndex - 0-based index in sorted holeIndices
 * @param {number} newHoleIndex
 * @returns {Object} New draft
 */
export function moveLevel(draft, levelIndex, newHoleIndex) {
  const sorted   = [...draft.holeIndices].sort((a, b) => a - b);
  const maxAllowed = maxAllowedHoleIndex(draft.frameSpec);
  const minGap   = minimumGapSteps(draft.beamSpec, draft.beamSpec);

  // Clamp to frame bounds (minimum 0)
  let target = Math.max(0, Math.min(newHoleIndex, maxAllowed));

  // Enforce minimum spacing with level below
  if (levelIndex > 0) {
    const lowerHole = sorted[levelIndex - 1];
    const minAboveLower = lowerHole + minGap;
    if (target < minAboveLower) target = minAboveLower;
  }

  // Enforce minimum spacing with level above
  if (levelIndex < sorted.length - 1) {
    const upperHole = sorted[levelIndex + 1];
    const maxBelowUpper = upperHole - minGap;
    if (target > maxBelowUpper) target = maxBelowUpper;
  }

  // If clamping made the position invalid (lower > upper after both constraints), abort
  if (
    (levelIndex > 0 && target - sorted[levelIndex - 1] < minGap) ||
    (levelIndex < sorted.length - 1 && sorted[levelIndex + 1] - target < minGap)
  ) {
    return draft;
  }

  const newHoles = [...sorted];
  newHoles[levelIndex] = target;
  return { ...draft, holeIndices: newHoles.sort((a, b) => a - b) };
}

// ── Commit draft → RackModule ─────────────────────────────────────────────────

/**
 * Build a new frozen RackModule from the current draft state.
 * Carries over the original module's startFrameIndex to preserve line positioning.
 *
 * @param {Object} draft
 * @param {number} [startFrameIndex=0]
 * @returns {import('./models/rackModule.js').RackModule}
 */
export function commitDraftToModule(draft, startFrameIndex = 0) {
  const { frameSpec, beamSpec, holeIndices, bayCount, rowConfiguration } = draft;
  const sorted = [...holeIndices].sort((a, b) => a - b);

  const levelUnion = sorted.map((holeIndex, i) =>
    createBeamLevel({
      id:         eid('lvl'),
      levelIndex: i,
      holeIndex,
      beamSpec,
    }),
  );

  const bays = [];
  for (let i = 0; i < bayCount; i++) {
    bays.push(createBay({
      id:             eid('bay'),
      leftFrameIndex: startFrameIndex + i,
      beamSpec,
      levels:         levelUnion,
    }));
  }

  return createRackModule({
    id:             eid('mod'),
    frameSpec,
    bays,
    levelUnion,
    startFrameIndex,
    rowIndex:       rowConfiguration !== RowConfiguration.SINGLE ? 0 : null,
  });
}
