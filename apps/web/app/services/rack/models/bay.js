// ─────────────────────────────────────────────────────────────────────────────
//  Bay Model
//
//  A bay is the horizontal span between two adjacent frames.
//  Reference: business_rules_racks.md — Section 2.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Bay
 * @property {string}      id                - Unique instance identifier
 * @property {number}      leftFrameIndex    - Position index of the left frame
 * @property {number}      rightFrameIndex   - Position index of the right frame (= left + 1)
 * @property {import('./beam.js').BeamSpec} beamSpec - Default beam spec for this bay
 * @property {import('./beam.js').BeamLevel[]} levels - Beam levels in this bay
 * @property {string[]}    accessoryIds      - IDs of accessories applied to this bay
 */

/**
 * Create a bay instance.
 *
 * Constraints enforced (Section 2.2):
 *   - rightFrameIndex = leftFrameIndex + 1
 *   - At least one level required for a complete bay
 *
 * @param {Object} params
 * @param {string}   params.id
 * @param {number}   params.leftFrameIndex
 * @param {import('./beam.js').BeamSpec}    params.beamSpec
 * @param {import('./beam.js').BeamLevel[]} params.levels
 * @param {string[]} [params.accessoryIds=[]]
 * @returns {Readonly<Bay>}
 */
export function createBay({ id, leftFrameIndex, beamSpec, levels, accessoryIds = [] }) {
  if (!Number.isInteger(leftFrameIndex) || leftFrameIndex < 0) {
    throw new RangeError('leftFrameIndex must be a non-negative integer.');
  }

  const rightFrameIndex = leftFrameIndex + 1;

  return Object.freeze({
    id,
    leftFrameIndex,
    rightFrameIndex,
    beamSpec,
    levels: Object.freeze([...levels]),
    accessoryIds: Object.freeze([...accessoryIds]),
  });
}

/**
 * Validate that a bay's beam length matches the expected bay width (beam length).
 * (Section 12: Beam length must match bay width)
 *
 * @param {Bay} bay
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateBayBeamLength(bay) {
  for (const level of bay.levels) {
    if (level.beamSpec.lengthIn !== bay.beamSpec.lengthIn) {
      return {
        valid: false,
        message: `Level ${level.levelIndex} beam length (${level.beamSpec.lengthIn}") does not match bay beam length (${bay.beamSpec.lengthIn}").`,
      };
    }
  }
  return { valid: true };
}

/**
 * Count the total number of physical beams in a bay.
 * Each level has 2 beams (left + right pair). (Section 2.3)
 *
 * @param {Bay} bay
 * @returns {number}
 */
export function bayBeamCount(bay) {
  return bay.levels.length * 2;
}
