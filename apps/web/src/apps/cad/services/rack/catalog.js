// ─────────────────────────────────────────────────────────────────────────────
//  Rack Catalog
//
//  Exports the industry-standard default configuration and derived layout
//  constants.  Default specs are resolved from the CSV catalog registry so
//  their IDs match the canonical CSV SKU format:
//    Frame : frame-{height}in-{depth}in-{beam_separation}in-g{gauge}
//    Beam  : beam-{gauge}g-{width}in-{height}in
//
//  Default configuration (most common selective pallet rack setup):
//    • Frame : depth=42", height=144", standard capacity class
//    • Beam  : length=96", standard capacity class
//    • Levels: 3 beam levels at holes 18, 36, 54
// ─────────────────────────────────────────────────────────────────────────────

import { findFrameSpec, findBeamSpec } from './catalogRegistry.js';

/** Unit conversion: inches → metres. */
export const INCH_TO_M = 0.0254;

/**
 * Upright series identifier shared between the default frame and beam.
 * All catalog entries using the standard upright profile share this value.
 */
const STANDARD_UPRIGHT_SERIES = 'standard';

// ── Default Frame Specification ──────────────────────────────────────────────
//  Source: frames.csv, height=144", depth=42", standard capacity class.
//  Resolves to the cheapest matching CSV row (load_capacity_kg 12,224.5–15,537 kg).

export const DEFAULT_FRAME_SPEC = findFrameSpec(144, 42, 'standard');

// ── Default Beam Specification ───────────────────────────────────────────────
//  Source: beams.csv, width=96", standard capacity class.
//  Resolves to the cheapest matching CSV row (load_capacity_kg 1,817.5–2,444 kg).

export const DEFAULT_BEAM_SPEC = findBeamSpec(96, 'standard');

// ── Default Beam Level Configuration ────────────────────────────────────────
//  3 levels evenly distributed across a 144" frame (1/4, 2/4, 3/4 of height):
//    Level 0 → hole 18 → elevation  36"
//    Level 1 → hole 36 → elevation  72"
//    Level 2 → hole 54 → elevation 108"

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
 */
export const BAY_STEP_M = DEFAULT_BAY_WIDTH_M - FRAME_WIDTH_M;  // 2.3622 m
