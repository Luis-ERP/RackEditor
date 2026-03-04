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
 * @property {import('./frame.js').FrameSpec}  frameSpec  - Frame spec for all frames in this module
 * @property {import('./bay.js').Bay[]}        bays       - Ordered bays (left → right)
 * @property {import('./beam.js').BeamLevel[]} levelUnion - The shared beam level config
 * @property {number}  frameCount             - Derived: bays.length + 1
 * @property {number}  startFrameIndex        - Starting frame position index in the parent line
 * @property {number}  endFrameIndex          - Ending frame position index in the parent line
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
 * @param {string}  params.id
 * @param {import('./frame.js').FrameSpec}  params.frameSpec
 * @param {import('./bay.js').Bay[]}        params.bays
 * @param {import('./beam.js').BeamLevel[]} params.levelUnion
 * @param {number}  params.startFrameIndex
 * @returns {Readonly<RackModule>}
 */
export function createRackModule({ id, frameSpec, bays, levelUnion, startFrameIndex }) {
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

  return Object.freeze({
    id,
    frameSpec,
    bays: Object.freeze([...bays]),
    levelUnion: Object.freeze([...levelUnion]),
    frameCount,
    startFrameIndex,
    endFrameIndex,
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
