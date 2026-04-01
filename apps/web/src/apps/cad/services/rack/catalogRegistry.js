// ─────────────────────────────────────────────────────────────────────────────
//  Catalog Registry
//
//  Enumerates all available FrameSpec and BeamSpec entries for the
//  rack module editor's attribute-filter pickers.
//
//  Specs are derived from the CSV catalog files in
//  src/core/rack/catalog_lists/. For each (heightIn, depthIn, capacityClass)
//  frame combination — or (lengthIn, capacityClass) beam combination — the
//  registry selects the cheapest CSV row whose load_capacity_kg falls within
//  the capacity class range, and uses that row's SKU as the spec ID.
//
//  Capacity class → load_capacity_kg ranges
//  ─────────────────────────────────────────
//  Frames  Light    :  8,000.0 – 12,224.5 kg
//          Standard : 12,224.5 – 15,537.0 kg
//          Medium   : 15,537.0 – 18,849.5 kg
//          Heavy    : 18,849.5 – 23,000.0 kg
//
//  Beams   Light    :    220.0 –  1,817.5 kg
//          Standard :  1,817.5 –  2,444.0 kg
//          Medium   :  2,444.0 –  3,263.0 kg
//          Heavy    :  3,263.0 –  5,204.0 kg
// ─────────────────────────────────────────────────────────────────────────────

import { createFrameSpec } from './models/frame.js';
import { createBeamSpec }  from './models/beam.js';
import { BEAMS_CSV, FRAMES_CSV } from '../../../../core/rack/catalog_lists/catalogData.js';

const STD_SERIES    = 'standard';
const STD_CONNECTOR = 'standard';

// ── Capacity class → load_capacity_kg ranges ──────────────────────────────────

const FRAME_CAPACITY_RANGES = {
  light:    [8000.0,   12224.5],
  standard: [12224.5,  15537.0],
  medium:   [15537.0,  18849.5],
  heavy:    [18849.5,  23000.0],
};

const BEAM_CAPACITY_RANGES = {
  light:    [220.0,   1817.5],
  standard: [1817.5,  2444.0],
  medium:   [2444.0,  3263.0],
  heavy:    [3263.0,  5204.0],
};

// ── Frame attribute options ───────────────────────────────────────────────────

/** Available frame heights in inches (must exist in frames.csv). */
export const FRAME_HEIGHTS_IN = [96, 120, 144, 168, 192];

/** Available frame depths in inches (must exist in frames.csv). */
export const FRAME_DEPTHS_IN = [36, 42];

/** Available frame capacity classes, ordered light → heavy. */
export const FRAME_CAPACITY_CLASSES = ['light', 'standard', 'medium', 'heavy'];

/** Human-readable labels for capacity classes. */
export const CAPACITY_LABELS = {
  light:    'Light',
  standard: 'Standard',
  medium:   'Medium',
  heavy:    'Heavy',
};

// ── Beam attribute options ────────────────────────────────────────────────────

/** Available beam lengths in inches (must exist in beams.csv). */
export const BEAM_LENGTHS_IN = [48, 92, 96, 102, 108, 120, 144];

/** Available beam capacity classes. */
export const BEAM_CAPACITY_CLASSES = ['light', 'standard', 'medium', 'heavy'];

// ── CSV lookup helpers ────────────────────────────────────────────────────────

/**
 * Find the cheapest CSV frame row matching height, depth, and capacity class.
 * The range check is half-open: [lo, hi).
 *
 * @param {number} heightIn
 * @param {number} depthIn
 * @param {string} capacityClass
 * @returns {Object|null}
 */
function cheapestFrameRow(heightIn, depthIn, capacityClass) {
  const range = FRAME_CAPACITY_RANGES[capacityClass];
  if (!range) return null;
  const [lo, hi] = range;

  let best = null;
  for (const row of FRAMES_CSV) {
    if (row.height_in !== heightIn || row.depth_in !== depthIn) continue;
    if (row.load_capacity_kg < lo || row.load_capacity_kg >= hi) continue;
    if (best === null || row.cost < best.cost) best = row;
  }
  return best;
}

/**
 * Find the cheapest CSV beam row matching width (length) and capacity class.
 * The range check is inclusive on both ends for the last class (heavy).
 *
 * @param {number} lengthIn
 * @param {string} capacityClass
 * @returns {Object|null}
 */
function cheapestBeamRow(lengthIn, capacityClass) {
  const range = BEAM_CAPACITY_RANGES[capacityClass];
  if (!range) return null;
  const [lo, hi] = range;

  let best = null;
  for (const row of BEAMS_CSV) {
    if (row.width_in !== lengthIn) continue;
    if (row.load_capacity_kg < lo || row.load_capacity_kg > hi) continue;
    if (best === null || row.price < best.price) best = row;
  }
  return best;
}

// ── Generate Frame Catalog ────────────────────────────────────────────────────

/**
 * Full catalog of all available frame specifications.
 * One entry per unique (heightIn, depthIn, capacityClass) combination.
 * The spec ID equals the CSV SKU of the cheapest frame row that satisfies the
 * capacity class range for the given dimensions.
 * @type {import('./models/frame.js').FrameSpec[]}
 */
export const FRAME_CATALOG = [];

for (const heightIn of FRAME_HEIGHTS_IN) {
  for (const depthIn of FRAME_DEPTHS_IN) {
    for (const capacityClass of FRAME_CAPACITY_CLASSES) {
      const row = cheapestFrameRow(heightIn, depthIn, capacityClass);
      if (!row) continue; // No CSV entry for this combination
      FRAME_CATALOG.push(createFrameSpec({
        id:                       row.sku,
        heightIn,
        depthIn,
        gauge:                    String(row.gauge),
        capacityClass,
        uprightSeries:            STD_SERIES,
        compatibleConnectorTypes: [STD_CONNECTOR],
        minimumTopClearanceIn:    6,
        basePlateType:            row.gauge <= 12 ? 'HEAVY_DUTY' : 'STANDARD',
      }));
    }
  }
}

// ── Generate Beam Catalog ─────────────────────────────────────────────────────

/**
 * Full catalog of all available beam specifications.
 * One entry per unique (lengthIn, capacityClass) combination.
 * The spec ID equals the CSV SKU of the cheapest beam row that satisfies the
 * capacity class range for the given length.
 * @type {import('./models/beam.js').BeamSpec[]}
 */
export const BEAM_CATALOG = [];

for (const lengthIn of BEAM_LENGTHS_IN) {
  for (const capacityClass of BEAM_CAPACITY_CLASSES) {
    const row = cheapestBeamRow(lengthIn, capacityClass);
    if (!row) continue; // No CSV entry for this combination
    const profileHeightIn = row.height_in;
    BEAM_CATALOG.push(createBeamSpec({
      id:                      row.sku,
      lengthIn,
      capacityClass,
      beamSeries:              row.gauge <= 12 ? 'structural' : 'standard',
      connectorType:           STD_CONNECTOR,
      verticalEnvelopeIn:      profileHeightIn,
      profileHeightIn,
      compatibleUprightSeries: [STD_SERIES],
    }));
  }
}

// ── Lookup Helpers ────────────────────────────────────────────────────────────

/**
 * Find a frame spec by its three primary attributes.
 * Returns the spec whose ID is the cheapest CSV SKU matching the combination,
 * or null if no catalog entry exists.
 *
 * @param {number} heightIn
 * @param {number} depthIn
 * @param {string} capacityClass
 * @returns {import('./models/frame.js').FrameSpec|null}
 */
export function findFrameSpec(heightIn, depthIn, capacityClass) {
  return FRAME_CATALOG.find(
    (f) => f.heightIn === heightIn && f.depthIn === depthIn && f.capacityClass === capacityClass,
  ) ?? null;
}

/**
 * Find a beam spec by its two primary attributes.
 * Returns the spec whose ID is the cheapest CSV SKU matching the combination,
 * or null if no catalog entry exists.
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
 * Return all beam specs compatible with the given frame (upright series + connector type).
 *
 * @param {import('./models/frame.js').FrameSpec} frameSpec
 * @returns {import('./models/beam.js').BeamSpec[]}
 */
export function getCompatibleBeams(frameSpec) {
  const allowedConnectors = new Set(frameSpec.compatibleConnectorTypes);
  return BEAM_CATALOG.filter(
    (b) =>
      b.compatibleUprightSeries.includes(frameSpec.uprightSeries) &&
      allowedConnectors.has(b.connectorType),
  );
}
