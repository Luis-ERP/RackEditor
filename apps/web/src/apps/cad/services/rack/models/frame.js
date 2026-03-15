// ─────────────────────────────────────────────────────────────────────────────
//  Frame Model
//
//  Frames are vertical assemblies (two upright columns + bracing) that define
//  the vertical support structure and establish bay boundaries.
//  Reference: business_rules_racks.md — Section 2.1
// ─────────────────────────────────────────────────────────────────────────────

import { HOLE_STEP_IN } from '../constants.js';

/**
 * @typedef {Object} FrameSpec
 * @property {string}   id                       - Unique identifier (catalog SKU or generated)
 * @property {number}   heightIn                 - Frame height in inches
 * @property {number}   depthIn                  - Frame depth in inches
 * @property {number}   beamSeparationIn         - Required beam length for bays adjacent to this frame (inches).
 *                                                  beam_separation = beam length; determines which beams are
 *                                                  structurally compatible with this frame. (Section 12.5)
 * @property {string}   gauge                    - Frame gauge designation
 * @property {string}   capacityClass            - Frame capacity class (max allowable load class)
 * @property {string}   uprightSeries            - Upright series / profile identifier
 * @property {string[]} compatibleConnectorTypes  - Connector types accepted by this frame's slot pattern
 * @property {number}   minimumTopClearanceIn     - Minimum required clearance from the top beam seat to the
 *                                                  frame top (inches). Catalog-defined; required. (Section 7)
 * @property {string}   [basePlateType]           - Base plate type (STANDARD | HEAVY_DUTY)
 */

/**
 * @typedef {Object} Frame
 * @property {string}      id               - Unique instance identifier
 * @property {FrameSpec}   spec             - Reference to the frame specification
 * @property {number}      positionIndex    - Ordered position along the rack line axis (0-based)
 * @property {boolean}     isCustomSpec     - true when this frame's spec was individually overridden
 *                                           from its parent module's default frameSpec
 * @property {number|null} rowIndex         - Row membership for back-to-back configurations.
 *                                           Must be set for every frame when rowConfiguration ≠ SINGLE.
 *                                           null for single-row rack lines. (Section 9.2.2)
 */

/**
 * Create a frame specification (catalog entry).
 *
 * @param {Object} params
 * @param {string}   params.id
 * @param {number}   params.heightIn
 * @param {number}   params.depthIn
 * @param {number}   params.beamSeparationIn
 * @param {string}   params.gauge
 * @param {string}   params.capacityClass
 * @param {string}   params.uprightSeries
 * @param {string[]} params.compatibleConnectorTypes
 * @param {number}   params.minimumTopClearanceIn
 * @param {string}   [params.basePlateType='STANDARD']
 * @returns {Readonly<FrameSpec>}
 */
export function createFrameSpec({
  id,
  heightIn,
  depthIn,
  beamSeparationIn,
  gauge,
  capacityClass,
  uprightSeries,
  compatibleConnectorTypes,
  minimumTopClearanceIn,
  basePlateType = 'STANDARD',
}) {
  if (heightIn <= 0) throw new RangeError('Frame height must be positive.');
  if (depthIn <= 0) throw new RangeError('Frame depth must be positive.');
  if (beamSeparationIn == null || beamSeparationIn <= 0) {
    throw new RangeError('beamSeparationIn must be a positive number. (Section 12.5)');
  }
  if (!Array.isArray(compatibleConnectorTypes) || compatibleConnectorTypes.length === 0) {
    throw new Error('compatibleConnectorTypes must be a non-empty array. (Section 12.1)');
  }
  if (minimumTopClearanceIn == null || minimumTopClearanceIn < 0) {
    throw new RangeError('minimumTopClearanceIn must be a non-negative number. (Section 7)');
  }

  return Object.freeze({
    id,
    heightIn,
    depthIn,
    beamSeparationIn,
    gauge,
    capacityClass,
    uprightSeries,
    compatibleConnectorTypes: Object.freeze([...compatibleConnectorTypes]),
    minimumTopClearanceIn,
    basePlateType,
  });
}

/**
 * Create a frame instance positioned within a rack line.
 *
 * @param {Object} params
 * @param {string}      params.id
 * @param {FrameSpec}   params.spec
 * @param {number}      params.positionIndex
 * @param {boolean}     [params.isCustomSpec=false] - Mark frame as individually customized
 * @param {number|null} [params.rowIndex=null]       - Row membership for back-to-back lines (Section 9.2.2)
 * @returns {Readonly<Frame>}
 */
export function createFrame({ id, spec, positionIndex, isCustomSpec = false, rowIndex = null }) {
  if (positionIndex < 0 || !Number.isInteger(positionIndex)) {
    throw new RangeError('Frame positionIndex must be a non-negative integer.');
  }
  if (rowIndex !== null && (!Number.isInteger(rowIndex) || rowIndex < 0)) {
    throw new RangeError('rowIndex must be a non-negative integer or null.');
  }

  return Object.freeze({
    id,
    spec,
    positionIndex,
    isCustomSpec,
    rowIndex,
  });
}

/**
 * Total number of holes available on a frame.
 *
 * @param {FrameSpec} spec
 * @returns {number}
 */
export function frameHoleCount(spec) {
  return Math.floor(spec.heightIn / HOLE_STEP_IN);
}

/**
 * Maximum hole index (0-based) that fits within the frame height.
 *
 * @param {FrameSpec} spec
 * @returns {number}
 */
export function maxHoleIndex(spec) {
  return Math.floor(spec.heightIn / HOLE_STEP_IN);
}

/**
 * Convert a hole index to an elevation in inches.
 *
 * @param {number} holeIndex — must be a non-negative integer
 * @returns {number} elevation in inches
 */
export function holeIndexToElevation(holeIndex) {
  if (!Number.isInteger(holeIndex) || holeIndex < 0) {
    throw new RangeError('holeIndex must be a non-negative integer.');
  }
  return holeIndex * HOLE_STEP_IN;
}

/**
 * Convert an elevation in inches to the nearest valid hole index.
 * Returns null if the elevation does not align to the hole grid.
 *
 * @param {number} elevationIn
 * @returns {number|null}
 */
export function elevationToHoleIndex(elevationIn) {
  if (elevationIn < 0) return null;
  const index = elevationIn / HOLE_STEP_IN;
  if (!Number.isInteger(index)) return null;
  return index;
}

/**
 * Derive the required frame count from a bay count.
 * (Section 2.1: frame_count = N + 1)
 *
 * @param {number} bayCount
 * @returns {number}
 */
export function frameCountFromBays(bayCount) {
  if (bayCount < 1 || !Number.isInteger(bayCount)) {
    throw new RangeError('bayCount must be a positive integer.');
  }
  return bayCount + 1;
}
