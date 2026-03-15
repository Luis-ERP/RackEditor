// ─────────────────────────────────────────────────────────────────────────────
//  Catalog Registry
//
//  Enumerates all available FrameSpec and BeamSpec entries for the
//  rack module editor's attribute-filter pickers.
//
//  Every (heightIn, depthIn, beamSeparationIn, capacityClass) combination
//  produces one FrameSpec. beamSeparationIn is the required beam length for
//  bays adjacent to the frame (beam_separation = beam length).
//  Every (lengthIn, capacityClass) combination produces one BeamSpec.
//  All catalog entries use the 'standard' upright series for compatibility.
// ─────────────────────────────────────────────────────────────────────────────

import { createFrameSpec } from './models/frame.js';
import { createBeamSpec }  from './models/beam.js';

const STD_SERIES    = 'standard';
const STD_CONNECTOR = 'standard';

// ── Frame attribute options ───────────────────────────────────────────────────

/** Available frame heights in inches. */
export const FRAME_HEIGHTS_IN = [96, 120, 144, 168, 192];

/** Available frame depths in inches. */
export const FRAME_DEPTHS_IN = [36, 42, 48];

/**
 * Available beam separation values in inches.
 * Each value represents the required beam length for bays adjacent to a frame
 * with this separation. beam_separation = beam length. (Section 12.5)
 */
export const FRAME_BEAM_SEPARATIONS_IN = [36, 42, 48, 54, 60, 72, 84, 96, 108];

/** Available frame capacity classes, ordered light → heavy. */
export const FRAME_CAPACITY_CLASSES = ['light', 'standard', 'medium', 'heavy'];

/** Human-readable labels for capacity classes. */
export const CAPACITY_LABELS = {
  light:    'Light',
  standard: 'Standard',
  medium:   'Medium',
  heavy:    'Heavy',
};

// Map capacity class → steel gauge (lighter gauge = thicker steel, higher capacity)
const FRAME_CAPACITY_TO_GAUGE = {
  light:    '14',
  standard: '14',
  medium:   '12',
  heavy:    '10',
};

// ── Beam attribute options ────────────────────────────────────────────────────

/** Available beam lengths in inches. Must cover all FRAME_BEAM_SEPARATIONS_IN values. */
export const BEAM_LENGTHS_IN = [36, 42, 48, 54, 60, 72, 84, 96, 108, 120];

/** Available beam capacity classes. */
export const BEAM_CAPACITY_CLASSES = ['light', 'standard', 'medium', 'heavy'];

// Map capacity class → beam series
const BEAM_CAPACITY_TO_SERIES = {
  light:    'standard',
  standard: 'standard',
  medium:   'structural',
  heavy:    'structural',
};

// Map capacity class → vertical connector envelope (inches below seat)
const BEAM_CAPACITY_TO_ENVELOPE = {
  light:    4,
  standard: 5,
  medium:   6,
  heavy:    8,
};

// Map capacity class → beam profile height (inches above seat)
const BEAM_CAPACITY_TO_PROFILE = {
  light:    4,
  standard: 5,
  medium:   6,
  heavy:    7,
};

// ── Generate Frame Catalog ────────────────────────────────────────────────────

/**
 * Full catalog of all available frame specifications.
 * One entry per unique (heightIn, depthIn, beamSeparationIn, capacityClass) combination.
 * @type {import('./models/frame.js').FrameSpec[]}
 */
export const FRAME_CATALOG = [];

for (const heightIn of FRAME_HEIGHTS_IN) {
  for (const depthIn of FRAME_DEPTHS_IN) {
    for (const beamSeparationIn of FRAME_BEAM_SEPARATIONS_IN) {
      for (const capacityClass of FRAME_CAPACITY_CLASSES) {
        const gauge = FRAME_CAPACITY_TO_GAUGE[capacityClass];
        FRAME_CATALOG.push(createFrameSpec({
          id:                       `frame-${gauge}g-${depthIn}in-${heightIn}in-${beamSeparationIn}in-${capacityClass}`,
          heightIn,
          depthIn,
          beamSeparationIn,
          gauge,
          capacityClass,
          uprightSeries:            STD_SERIES,
          compatibleConnectorTypes: [STD_CONNECTOR],
          minimumTopClearanceIn:    6,
          basePlateType:            capacityClass === 'heavy' ? 'HEAVY_DUTY' : 'STANDARD',
        }));
      }
    }
  }
}

// ── Generate Beam Catalog ─────────────────────────────────────────────────────

/**
 * Full catalog of all available beam specifications.
 * One entry per unique (lengthIn, capacityClass) combination.
 * @type {import('./models/beam.js').BeamSpec[]}
 */
export const BEAM_CATALOG = [];

for (const lengthIn of BEAM_LENGTHS_IN) {
  for (const capacityClass of BEAM_CAPACITY_CLASSES) {
    const beamSeries       = BEAM_CAPACITY_TO_SERIES[capacityClass];
    const verticalEnvelopeIn = BEAM_CAPACITY_TO_ENVELOPE[capacityClass];
    const profileHeightIn  = BEAM_CAPACITY_TO_PROFILE[capacityClass];
    BEAM_CATALOG.push(createBeamSpec({
      id:                      `beam-${capacityClass}-${lengthIn}in`,
      lengthIn,
      capacityClass,
      beamSeries,
      connectorType:           STD_CONNECTOR,
      verticalEnvelopeIn,
      profileHeightIn,
      compatibleUprightSeries: [STD_SERIES],
    }));
  }
}

// ── Lookup Helpers ────────────────────────────────────────────────────────────

/**
 * Find a frame spec by its four primary attributes.
 * Returns null if no catalog entry matches.
 *
 * @param {number} heightIn
 * @param {number} depthIn
 * @param {number} beamSeparationIn
 * @param {string} capacityClass
 * @returns {import('./models/frame.js').FrameSpec|null}
 */
export function findFrameSpec(heightIn, depthIn, beamSeparationIn, capacityClass) {
  return FRAME_CATALOG.find(
    (f) =>
      f.heightIn === heightIn &&
      f.depthIn === depthIn &&
      f.beamSeparationIn === beamSeparationIn &&
      f.capacityClass === capacityClass,
  ) ?? null;
}

/**
 * Find a beam spec by its two primary attributes.
 * Returns null if no catalog entry matches.
 *
 * @param {number} lengthIn
 * @param {string} capacityClass
 * @returns {import('./models/beam.js').BeamSpec|null}
 */
export function findBeamSpec(lengthIn, capacityClass) {
  return BEAM_CATALOG.find(
    (b) => b.lengthIn === lengthIn && b.capacityClass === capacityClass,
  ) ?? null;
}

/**
 * Return all beam specs compatible with the given frame.
 * Filters by upright series, connector type, and required beam length
 * (beam.lengthIn must equal frame.beamSeparationIn). (Section 12.5)
 *
 * @param {import('./models/frame.js').FrameSpec} frameSpec
 * @returns {import('./models/beam.js').BeamSpec[]}
 */
export function getCompatibleBeams(frameSpec) {
  const allowedConnectors = new Set(frameSpec.compatibleConnectorTypes);
  return BEAM_CATALOG.filter(
    (b) =>
      b.compatibleUprightSeries.includes(frameSpec.uprightSeries) &&
      allowedConnectors.has(b.connectorType) &&
      b.lengthIn === frameSpec.beamSeparationIn,
  );
}
