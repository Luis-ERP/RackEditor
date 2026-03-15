// ─────────────────────────────────────────────────────────────────────────────
//  Rack Catalog
//
//  Defines catalog entries (FrameSpec, BeamSpec) sourced from the shared CSV
//  catalog files in src/core/rack/catalog_lists and exports the
//  industry-standard default configuration.
//
//  Default configuration (most common selective pallet rack setup):
//    • Frame : 14-gauge, 42" deep, 144" high  (12-ft upright, standard for general warehousing)
//    • Beam  : 14-gauge, 96" wide, 5" high    (8-ft beam, fits 2 standard GMA pallets per bay)
//    • Levels: 3 beam levels at holes 1, 27, 51 → elevations 2", 54", 102"
//              Provides ~48" of clear vertical space per pallet level.
// ─────────────────────────────────────────────────────────────────────────────

import { createFrameSpec } from './models/frame.js';
import { createBeamSpec }  from './models/beam.js';

/** Unit conversion: inches → metres. */
export const INCH_TO_M = 0.0254;

/**
 * Upright series identifier shared between the default frame and beam.
 * All catalog entries using the standard upright profile share this value.
 */
const STANDARD_UPRIGHT_SERIES = 'standard';

// ── Default Frame Specification ──────────────────────────────────────────────
//  Source row (frames.csv): gauge=14, depth_in=42, height_in=144, beam_separation_in=96
//  Most common 12-foot selective rack upright for general warehouse use.

export const DEFAULT_FRAME_SPEC = createFrameSpec({
  id:                       'frame-14g-42in-144in-96in',
  heightIn:                 144,
  depthIn:                  42,
  beamSeparationIn:         96,
  gauge:                    '14',
  capacityClass:            'standard',
  uprightSeries:            STANDARD_UPRIGHT_SERIES,
  compatibleConnectorTypes: ['standard'],
  minimumTopClearanceIn:    6,
  basePlateType:            'STANDARD',
});

// ── Default Beam Specification ───────────────────────────────────────────────
//  Source row (beams.csv): gauge=14, width_in=96, height_in=5
//  8-foot beam — the single most common beam length in selective pallet racking.
//  Holds two standard 40"-wide GMA pallets with clearance on each side.

export const DEFAULT_BEAM_SPEC = createBeamSpec({
  id:                       'beam-14g-96in-5in',
  lengthIn:                 96,
  capacityClass:            'standard',
  beamSeries:               'standard',
  connectorType:            'standard',
  verticalEnvelopeIn:       5,
  profileHeightIn:          5,
  compatibleUprightSeries:  [STANDARD_UPRIGHT_SERIES],
});

// ── Default Beam Level Configuration ────────────────────────────────────────
//  3 levels evenly distributed across a 144" frame (1/4, 2/4, 3/4 of height):
//    Level 0 → hole 18 → elevation  36" (1/4 × 144")
//    Level 1 → hole 36 → elevation  72" (2/4 × 144")
//    Level 2 → hole 54 → elevation 108" (3/4 × 144")

export const DEFAULT_HOLE_INDICES = [18, 36, 54];

// ── Derived Layout Dimensions ────────────────────────────────────────────────

/** Default bay width in metres  (96"  × 0.0254 = 2.4384 m). */
export const DEFAULT_BAY_WIDTH_M   = DEFAULT_BEAM_SPEC.lengthIn  * INCH_TO_M;

/** Default frame depth in metres (42"  × 0.0254 = 1.0668 m). */
export const DEFAULT_FRAME_DEPTH_M = DEFAULT_FRAME_SPEC.depthIn  * INCH_TO_M;

/** Default frame height in metres (144" × 0.0254 = 3.6576 m). */
export const DEFAULT_FRAME_HEIGHT_M = DEFAULT_FRAME_SPEC.heightIn * INCH_TO_M;

/**
 * Upright column footprint width in plan view (3" standard).
 * Used to compute the overlap between adjacent bays sharing a frame.
 */
export const FRAME_WIDTH_M = 3 * INCH_TO_M;   // 0.0762 m

/**
 * Spacing between the origins of two adjacent bays that share a frame.
 * = beam length (96") − one frame width (3") = 93" = 2.3622 m
 * Placing bay N at N × BAY_STEP_M means each shared upright occupies
 * the same physical space as the right frame of the previous bay.
 */
export const BAY_STEP_M = DEFAULT_BAY_WIDTH_M - FRAME_WIDTH_M;  // 2.3622 m
