// ─────────────────────────────────────────────────────────────────────────────
//  Beam & Beam Level Models
//
//  Beams are horizontal structural members connecting two frames.
//  Beam levels define vertical load positions within the rack.
//  Reference: business_rules_racks.md — Sections 2.3, 2.4, 4, 5, 6
// ─────────────────────────────────────────────────────────────────────────────

import { HOLE_STEP_IN } from '../constants.js';

/**
 * @typedef {Object} BeamSpec
 * @property {string}  id                      - Catalog SKU / identifier
 * @property {number}  lengthIn                - Beam length in inches (determines bay width)
 * @property {string}  capacityClass           - Beam capacity class
 * @property {string}  beamSeries              - Beam series / profile
 * @property {string}  connectorType           - Connector type (must match frame slot pattern)
 * @property {number}  verticalEnvelopeIn      - Vertical clearance consumed by connector (inches)
 * @property {string[]} compatibleUprightSeries - Upright series this beam is compatible with
 */

/**
 * @typedef {Object} BeamLevel
 * @property {string}   id            - Unique identifier for this level
 * @property {number}   levelIndex    - Ordered index (0 = lowest, ascending)
 * @property {number}   holeIndex     - Hole position on the frame (integer, 0-based)
 * @property {number}   elevationIn   - Derived: holeIndex × HOLE_STEP_IN
 * @property {BeamSpec} beamSpec      - The beam specification for this level
 */

/**
 * Create a beam specification (catalog entry).
 *
 * @param {Object} params
 * @param {string}   params.id
 * @param {number}   params.lengthIn
 * @param {string}   params.capacityClass
 * @param {string}   params.beamSeries
 * @param {string}   params.connectorType
 * @param {number}   params.verticalEnvelopeIn
 * @param {string[]} params.compatibleUprightSeries
 * @returns {Readonly<BeamSpec>}
 */
export function createBeamSpec({
  id,
  lengthIn,
  capacityClass,
  beamSeries,
  connectorType,
  verticalEnvelopeIn,
  compatibleUprightSeries,
}) {
  if (lengthIn <= 0) throw new RangeError('Beam length must be positive.');
  if (verticalEnvelopeIn < 0) throw new RangeError('Vertical envelope must be non-negative.');
  if (!Array.isArray(compatibleUprightSeries) || compatibleUprightSeries.length === 0) {
    throw new Error('compatibleUprightSeries must be a non-empty array.');
  }

  return Object.freeze({
    id,
    lengthIn,
    capacityClass,
    beamSeries,
    connectorType,
    verticalEnvelopeIn,
    compatibleUprightSeries: Object.freeze([...compatibleUprightSeries]),
  });
}

/**
 * Create a beam level (vertical position + beam spec assignment).
 *
 * @param {Object} params
 * @param {string}   params.id
 * @param {number}   params.levelIndex
 * @param {number}   params.holeIndex   - Must be a non-negative integer
 * @param {BeamSpec} params.beamSpec
 * @returns {Readonly<BeamLevel>}
 */
export function createBeamLevel({ id, levelIndex, holeIndex, beamSpec }) {
  if (!Number.isInteger(holeIndex) || holeIndex < 0) {
    throw new RangeError('holeIndex must be a non-negative integer (hole grid alignment).');
  }
  if (!Number.isInteger(levelIndex) || levelIndex < 0) {
    throw new RangeError('levelIndex must be a non-negative integer.');
  }

  return Object.freeze({
    id,
    levelIndex,
    holeIndex,
    elevationIn: holeIndex * HOLE_STEP_IN,
    beamSpec,
  });
}

/**
 * Compute the minimum vertical gap (in holes) between two adjacent beam levels.
 * (Section 5)
 *
 * minimum_gap_in = hole_step + max(envelope_lower, envelope_upper)
 * minimum_gap_steps = ceil(minimum_gap_in / hole_step)
 *
 * @param {BeamSpec} lowerBeamSpec - Beam spec at the lower level
 * @param {BeamSpec} upperBeamSpec - Beam spec at the upper level
 * @returns {number} Minimum hole index difference required
 */
export function minimumGapSteps(lowerBeamSpec, upperBeamSpec) {
  const governingEnvelope = Math.max(
    lowerBeamSpec.verticalEnvelopeIn,
    upperBeamSpec.verticalEnvelopeIn,
  );
  const minimumGapIn = HOLE_STEP_IN + governingEnvelope;
  return Math.ceil(minimumGapIn / HOLE_STEP_IN);
}

/**
 * Validate that a sorted array of beam levels respects minimum spacing rules.
 * Returns an array of error objects (empty = valid).
 *
 * @param {BeamLevel[]} levels - Sorted by levelIndex ascending
 * @returns {{ levelIndex: number, message: string }[]}
 */
export function validateLevelSpacing(levels) {
  const errors = [];
  const sorted = [...levels].sort((a, b) => a.holeIndex - b.holeIndex);

  for (let i = 0; i < sorted.length; i++) {
    // Strict ordering check (Section 6.1)
    if (i > 0 && sorted[i].holeIndex <= sorted[i - 1].holeIndex) {
      errors.push({
        levelIndex: sorted[i].levelIndex,
        message: `Level ${sorted[i].levelIndex} holeIndex (${sorted[i].holeIndex}) is not strictly greater than previous level (${sorted[i - 1].holeIndex}).`,
      });
    }

    // Minimum spacing check (Section 6.2)
    if (i > 0) {
      const reqGap = minimumGapSteps(sorted[i - 1].beamSpec, sorted[i].beamSpec);
      const actualGap = sorted[i].holeIndex - sorted[i - 1].holeIndex;
      if (actualGap < reqGap) {
        errors.push({
          levelIndex: sorted[i].levelIndex,
          message: `Level ${sorted[i].levelIndex} is too close to level ${sorted[i - 1].levelIndex}. Required gap: ${reqGap} holes, actual: ${actualGap} holes.`,
        });
      }
    }
  }

  return errors;
}

/**
 * Check whether a beam spec is compatible with a given frame upright series.
 * (Section 12)
 *
 * @param {BeamSpec} beamSpec
 * @param {string}   uprightSeries
 * @returns {boolean}
 */
export function isBeamCompatibleWithFrame(beamSpec, uprightSeries) {
  return beamSpec.compatibleUprightSeries.includes(uprightSeries);
}
