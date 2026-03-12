// ─────────────────────────────────────────────────────────────────────────────
//  Rack Module Editor Utilities
//
//  Pure domain-layer helper functions used by the RackModuleEditor UI.
//  No React, no side effects — all functions are deterministic and testable.
//
//  Draft shape:
//    { frameSpec, beamLengthIn, beamSpecs[], holeIndices[], bayCount,
//      rowConfiguration, spacerSizeIn }
//
//  beamSpecs[] is a parallel array to holeIndices[] (sorted ascending).
//  beamSpecs[i] is the BeamSpec for the level at holeIndices[i].
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
import { findBeamSpec }                               from './catalogRegistry.js';

// ── ID Generator (editor-scoped, distinct from factory IDs) ──────────────────
let _counter = 0;
function eid(prefix) { return `${prefix}_e${++_counter}`; }

// ── Dimension helpers ─────────────────────────────────────────────────────────

/**
 * Compute entity widthM and depthM from beam length, frame spec, and bay count.
 * Used to update the layout entity when the editor changes specs.
 *
 * @param {{ lengthIn: number }} beamOrLengthProxy
 * @param {import('./models/frame.js').FrameSpec} frameSpec
 * @param {number} bayCount
 * @returns {{ widthM: number, depthM: number }}
 */
export function computeEntityDimensions(beamOrLengthProxy, frameSpec, bayCount) {
  const bayStepM = beamOrLengthProxy.lengthIn * INCH_TO_M - FRAME_WIDTH_M;
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
  const maxHole        = maxHoleIndex(frameSpec);
  const clearanceHoles = Math.ceil(frameSpec.minimumTopClearanceIn / HOLE_STEP_IN);
  return Math.max(0, maxHole - clearanceHoles);
}

/**
 * Find the next valid hole index for a new level added above all existing levels.
 * Returns null if there is no room in the frame.
 *
 * @param {number[]} holeIndices - Existing hole indices (may be empty)
 * @param {import('./models/frame.js').FrameSpec} frameSpec
 * @param {import('./models/beam.js').BeamSpec|null}   topBeamSpec  - Spec of current topmost level (null if empty)
 * @param {import('./models/beam.js').BeamSpec}        newBeamSpec  - Spec for the new level
 * @returns {number|null}
 */
export function autoPositionNewLevel(holeIndices, frameSpec, topBeamSpec, newBeamSpec) {
  const maxAllowed = maxAllowedHoleIndex(frameSpec);

  if (holeIndices.length === 0) {
    return maxAllowed >= 1 ? 1 : null;
  }

  const sorted    = [...holeIndices].sort((a, b) => a - b);
  const topHole   = sorted[sorted.length - 1];
  const minGap    = minimumGapSteps(topBeamSpec ?? newBeamSpec, newBeamSpec);
  const candidate = topHole + minGap;
  return candidate <= maxAllowed ? candidate : null;
}

/**
 * Clamp hole indices (and their parallel beamSpecs) to remain within the frame
 * height after a frame or beam spec change.
 * Indices that exceed the new max are removed. The remaining indices are
 * re-checked for minimum spacing — indices that violate spacing are removed
 * (bottom-up, keeping lower levels).
 *
 * @param {number[]} holeIndices
 * @param {import('./models/beam.js').BeamSpec[]} beamSpecs  - Parallel to holeIndices
 * @param {import('./models/frame.js').FrameSpec} newFrameSpec
 * @returns {{ holeIndices: number[], beamSpecs: import('./models/beam.js').BeamSpec[] }}
 */
export function clampHoleIndicesToFrame(holeIndices, beamSpecs, newFrameSpec) {
  const maxAllowed = maxAllowedHoleIndex(newFrameSpec);

  // Zip, sort, filter by max
  const pairs = holeIndices
    .map((h, i) => ({ h, spec: beamSpecs[i] }))
    .sort((a, b) => a.h - b.h)
    .filter((p) => p.h <= maxAllowed);

  // Remove spacing violations (keep lower, drop violating upper)
  const kept = [];
  for (const p of pairs) {
    if (kept.length === 0) {
      kept.push(p);
    } else {
      const prev   = kept[kept.length - 1];
      const minGap = minimumGapSteps(prev.spec, p.spec);
      if (p.h - prev.h >= minGap) kept.push(p);
    }
  }

  return {
    holeIndices: kept.map((p) => p.h),
    beamSpecs:   kept.map((p) => p.spec),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Run business-rule validation on a draft state.
 * Builds a temporary single-module RackLine and calls validateRackLine.
 *
 * @param {{ frameSpec, beamLengthIn, beamSpecs, holeIndices, bayCount, rowConfiguration, spacerSizeIn }} draft
 * @returns {import('./validation.js').ValidationResult}
 */
export function computeDraftValidation(draft) {
  const {
    frameSpec,
    beamLengthIn,
    beamSpecs        = [],
    holeIndices,
    bayCount         = 1,
    rowConfiguration = RowConfiguration.SINGLE,
    spacerSizeIn     = 6,
  } = draft;

  if (!frameSpec || !beamLengthIn) {
    return { state: 'INCOMPLETE', errors: [], warnings: [] };
  }

  const fallbackSpec = findBeamSpec(beamLengthIn, 'standard');
  if (!fallbackSpec) {
    return { state: 'INCOMPLETE', errors: [], warnings: [] };
  }

  // Build beam levels
  let levelUnion = [];
  if (holeIndices.length > 0) {
    const sorted = [...holeIndices].sort((a, b) => a - b);
    levelUnion = sorted.map((holeIndex, i) =>
      createBeamLevel({
        id:         eid('lvl'),
        levelIndex: i,
        holeIndex,
        beamSpec:   beamSpecs[i] ?? fallbackSpec,
      }),
    );
  }

  // Build bays
  const baySpec = beamSpecs[0] ?? fallbackSpec;
  const bays = [];
  for (let i = 0; i < bayCount; i++) {
    bays.push(createBay({
      id:             eid('bay'),
      leftFrameIndex: i,
      beamSpec:       baySpec,
      levels:         levelUnion,
    }));
  }

  // Build module
  let mod;
  try {
    mod = createRackModule({
      id:              eid('mod'),
      frameSpec,
      bays,
      levelUnion,
      startFrameIndex: 0,
      rowIndex:        rowConfiguration !== RowConfiguration.SINGLE ? 0 : null,
    });
  } catch {
    return {
      state: 'INVALID',
      errors: [{ code: 'FACTORY_ERROR', message: 'Invalid module configuration.', severity: 'error', context: {} }],
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
      errors: [{ code: 'LINE_CONFIG_ERROR', message: 'Invalid rack line configuration.', severity: 'error', context: {} }],
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
  const { holeIndices, beamSpecs } = clampHoleIndicesToFrame(
    draft.holeIndices, draft.beamSpecs, newFrameSpec,
  );
  return { ...draft, frameSpec: newFrameSpec, holeIndices, beamSpecs };
}

/**
 * Produce a new draft with a different beam length applied.
 * All per-level beam specs are mapped to the new length preserving their
 * capacity class. Spacing is re-validated.
 *
 * @param {Object} draft
 * @param {number} newLengthIn
 * @returns {Object} New draft
 */
export function applyBeamLength(draft, newLengthIn) {
  const newBeamSpecs = draft.beamSpecs.map((spec) => {
    const found = findBeamSpec(newLengthIn, spec.capacityClass);
    return found ?? spec;
  });
  const { holeIndices, beamSpecs } = clampHoleIndicesToFrame(
    draft.holeIndices, newBeamSpecs, draft.frameSpec,
  );
  return { ...draft, beamLengthIn: newLengthIn, holeIndices, beamSpecs };
}

/**
 * Produce a new draft with one level's beam spec replaced.
 * Spacing is re-validated after the change.
 *
 * @param {Object} draft
 * @param {number} levelIndex - 0-based index in sorted holeIndices
 * @param {import('./models/beam.js').BeamSpec} newBeamSpec
 * @returns {Object} New draft
 */
export function applyLevelBeamSpec(draft, levelIndex, newBeamSpec) {
  const newBeamSpecs = [...draft.beamSpecs];
  newBeamSpecs[levelIndex] = newBeamSpec;
  const { holeIndices, beamSpecs } = clampHoleIndicesToFrame(
    draft.holeIndices, newBeamSpecs, draft.frameSpec,
  );
  return { ...draft, holeIndices, beamSpecs };
}

/**
 * Add a new beam level at the next valid position above the highest existing
 * level. The new level inherits the topmost level's capacity class.
 * Returns the unchanged draft if there is no room.
 *
 * @param {Object} draft
 * @returns {Object} New draft
 */
export function addLevel(draft) {
  const sorted    = [...draft.holeIndices].sort((a, b) => a - b);
  const topSpec   = draft.beamSpecs.length > 0 ? draft.beamSpecs[draft.beamSpecs.length - 1] : null;
  const fallback  = findBeamSpec(draft.beamLengthIn, 'standard');
  const newSpec   = topSpec ?? fallback;

  const next = autoPositionNewLevel(draft.holeIndices, draft.frameSpec, topSpec, newSpec);
  if (next === null) return draft;

  // Insert in sorted order
  const newHoleIndices = [...sorted, next].sort((a, b) => a - b);
  const insertPos      = newHoleIndices.indexOf(next);
  const newBeamSpecs   = [...draft.beamSpecs];
  newBeamSpecs.splice(insertPos, 0, newSpec);

  return { ...draft, holeIndices: newHoleIndices, beamSpecs: newBeamSpecs };
}

/**
 * Remove the level at the given sorted index (0-based within sorted holeIndices).
 *
 * @param {Object} draft
 * @param {number} levelIndex
 * @returns {Object} New draft
 */
export function removeLevel(draft, levelIndex) {
  const sorted       = [...draft.holeIndices].sort((a, b) => a - b);
  const newHoles     = sorted.filter((_, i) => i !== levelIndex);
  const newBeamSpecs = draft.beamSpecs.filter((_, i) => i !== levelIndex);
  return { ...draft, holeIndices: newHoles, beamSpecs: newBeamSpecs };
}

/**
 * Move a beam level to a new hole index.
 * The new index is clamped to the valid range for the frame.
 * Adjacent spacing constraints use per-level beam specs.
 * Returns the unchanged draft if the move is not possible.
 *
 * @param {Object} draft
 * @param {number} levelIndex - 0-based index in sorted holeIndices
 * @param {number} newHoleIndex
 * @returns {Object} New draft
 */
export function moveLevel(draft, levelIndex, newHoleIndex) {
  const sorted     = [...draft.holeIndices].sort((a, b) => a - b);
  const maxAllowed = maxAllowedHoleIndex(draft.frameSpec);
  const thisSpec   = draft.beamSpecs[levelIndex];

  // Clamp to frame bounds
  let target = Math.max(0, Math.min(newHoleIndex, maxAllowed));

  // Enforce minimum spacing with level below
  if (levelIndex > 0) {
    const lowerSpec     = draft.beamSpecs[levelIndex - 1];
    const minAboveLower = sorted[levelIndex - 1] + minimumGapSteps(lowerSpec, thisSpec);
    if (target < minAboveLower) target = minAboveLower;
  }

  // Enforce minimum spacing with level above
  if (levelIndex < sorted.length - 1) {
    const upperSpec     = draft.beamSpecs[levelIndex + 1];
    const maxBelowUpper = sorted[levelIndex + 1] - minimumGapSteps(thisSpec, upperSpec);
    if (target > maxBelowUpper) target = maxBelowUpper;
  }

  // Abort if constraints are contradictory
  if (
    (levelIndex > 0 && target - sorted[levelIndex - 1] < minimumGapSteps(draft.beamSpecs[levelIndex - 1], thisSpec)) ||
    (levelIndex < sorted.length - 1 && sorted[levelIndex + 1] - target < minimumGapSteps(thisSpec, draft.beamSpecs[levelIndex + 1]))
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
  const { frameSpec, beamLengthIn, beamSpecs, holeIndices, bayCount, rowConfiguration } = draft;
  const fallbackSpec = findBeamSpec(beamLengthIn, 'standard');
  const sorted = [...holeIndices].sort((a, b) => a - b);

  const levelUnion = sorted.map((holeIndex, i) =>
    createBeamLevel({
      id:         eid('lvl'),
      levelIndex: i,
      holeIndex,
      beamSpec:   beamSpecs[i] ?? fallbackSpec,
    }),
  );

  const baySpec = beamSpecs[0] ?? fallbackSpec;
  const bays = [];
  for (let i = 0; i < bayCount; i++) {
    bays.push(createBay({
      id:             eid('bay'),
      leftFrameIndex: startFrameIndex + i,
      beamSpec:       baySpec,
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
