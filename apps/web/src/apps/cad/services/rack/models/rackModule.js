// ─────────────────────────────────────────────────────────────────────────────
//  Rack Module Model
//
//  A module is a contiguous segment within a rack line. It starts and ends
//  with a frame and contains a single beam-level union (all bays in the
//  module share the same beam level configuration).
//
//  Two or more consecutive modules can share adjacent frames.
//
//  Reference: business_rules_racks.md — Section 9
// ─────────────────────────────────────────────────────────────────────────────

import { frameCountFromBays } from './frame.js';

/**
 * @typedef {Object} RackModule
 * @property {string}  id                     - Unique identifier
 * @property {import('./frame.js').FrameSpec}  frameSpec      - Default frame spec for all frames in this module
 * @property {Object.<number, import('./frame.js').FrameSpec>} frameOverrides
 *                                            - Per-frame spec overrides keyed by local frame index
 *                                              (0 = first frame of this module, frameCount-1 = last).
 *                                              Frames not listed here inherit frameSpec.
 * @property {import('./bay.js').Bay[]}        bays           - Ordered bays (left → right)
 * @property {import('./beam.js').BeamLevel[]} levelUnion     - The shared beam level config
 * @property {number}  frameCount             - Derived: bays.length + 1
 * @property {number}  startFrameIndex        - Starting frame position index in the parent line
 * @property {number}  endFrameIndex          - Ending frame position index in the parent line
 * @property {number|null} rowIndex           - Row membership for back-to-back configurations.
 *                                             Required when the parent line rowConfiguration ≠ SINGLE.
 *                                             null for single-row lines. (Section 9.2.2, 9.2.4)
 */

/**
 * Create a rack module.
 *
 * Invariants:
 *   - bays must be non-empty (≥ 1 bay)
 *   - All bays must be consecutive (bay[i].rightFrameIndex === bay[i+1].leftFrameIndex)
 *   - levelUnion defines the shared beam levels across all bays
 *   - frameCount = bays.length + 1
 *
 * @param {Object} params
 * @param {string}      params.id
 * @param {import('./frame.js').FrameSpec}  params.frameSpec
 * @param {import('./bay.js').Bay[]}        params.bays
 * @param {import('./beam.js').BeamLevel[]} params.levelUnion
 * @param {number}      params.startFrameIndex
 * @param {Object.<number, import('./frame.js').FrameSpec>} [params.frameOverrides={}]
 *   Per-frame overrides keyed by local frame index (0-based within this module).
 * @param {number|null} [params.rowIndex=null] - Row membership for back-to-back configurations (Section 9.2.2)
 * @returns {Readonly<RackModule>}
 */
export function createRackModule({ id, frameSpec, bays, levelUnion, startFrameIndex, frameOverrides = {}, rowIndex = null }) {
  if (!Array.isArray(bays) || bays.length < 1) {
    throw new Error('A rack module must contain at least 1 bay.');
  }

  // Validate consecutive bay ordering
  for (let i = 1; i < bays.length; i++) {
    if (bays[i].leftFrameIndex !== bays[i - 1].rightFrameIndex) {
      throw new Error(
        `Bay at index ${i} is not consecutive with previous bay. ` +
        `Expected leftFrameIndex=${bays[i - 1].rightFrameIndex}, got ${bays[i].leftFrameIndex}.`
      );
    }
  }

  const frameCount = frameCountFromBays(bays.length);
  const endFrameIndex = startFrameIndex + bays.length;

  // Validate frameOverrides keys are within range [0, frameCount-1]
  for (const key of Object.keys(frameOverrides)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= frameCount) {
      throw new RangeError(
        `frameOverrides key ${key} is out of range [0, ${frameCount - 1}] for this module.`
      );
    }
  }

  return Object.freeze({
    id,
    frameSpec,
    frameOverrides: Object.freeze({ ...frameOverrides }),
    bays: Object.freeze([...bays]),
    levelUnion: Object.freeze([...levelUnion]),
    frameCount,
    startFrameIndex,
    endFrameIndex,
    rowIndex,
  });
}

/**
 * Get the number of bays in a module.
 *
 * @param {RackModule} mod
 * @returns {number}
 */
export function moduleBayCount(mod) {
  return mod.bays.length;
}

/**
 * Get all frame position indices for a module.
 *
 * @param {RackModule} mod
 * @returns {number[]}
 */
export function moduleFrameIndices(mod) {
  const indices = [];
  for (let i = mod.startFrameIndex; i <= mod.endFrameIndex; i++) {
    indices.push(i);
  }
  return indices;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Per-Frame Customization Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the effective FrameSpec for a given local frame index within a module.
 *
 * Returns the override if one has been recorded for that position, otherwise
 * falls back to the module's default frameSpec.
 *
 * @param {RackModule} mod
 * @param {number}     localFrameIndex  - 0-based index within this module (0 … frameCount-1)
 * @returns {import('./frame.js').FrameSpec}
 */
export function resolveFrameSpecAtIndex(mod, localFrameIndex) {
  if (!Number.isInteger(localFrameIndex) || localFrameIndex < 0 || localFrameIndex >= mod.frameCount) {
    throw new RangeError(
      `localFrameIndex ${localFrameIndex} is out of range [0, ${mod.frameCount - 1}].`
    );
  }
  return mod.frameOverrides[localFrameIndex] ?? mod.frameSpec;
}

/**
 * Return a new RackModule with an individual frame override applied (or cleared).
 *
 * All other module properties remain unchanged.
 *
 * @param {RackModule}                       mod
 * @param {number}                           localFrameIndex  - 0-based index within the module
 * @param {import('./frame.js').FrameSpec|null} frameSpec
 *   Pass a FrameSpec to set/replace an override; pass null to remove it and restore the default.
 * @returns {Readonly<RackModule>}
 */
export function withFrameOverride(mod, localFrameIndex, frameSpec) {
  if (!Number.isInteger(localFrameIndex) || localFrameIndex < 0 || localFrameIndex >= mod.frameCount) {
    throw new RangeError(
      `localFrameIndex ${localFrameIndex} is out of range [0, ${mod.frameCount - 1}].`
    );
  }

  const updatedOverrides = { ...mod.frameOverrides };

  if (frameSpec === null) {
    delete updatedOverrides[localFrameIndex];
  } else {
    updatedOverrides[localFrameIndex] = frameSpec;
  }

  return createRackModule({
    id:               mod.id,
    frameSpec:        mod.frameSpec,
    bays:             [...mod.bays],
    levelUnion:       [...mod.levelUnion],
    startFrameIndex:  mod.startFrameIndex,
    frameOverrides:   updatedOverrides,
    rowIndex:         mod.rowIndex,
  });
}
