// ─────────────────────────────────────────────────────────────────────────────
//  Rack Catalog
//
//  Re-exports the industry-standard default configuration sourced from the
//  catalog registry (which is generated from the CSV catalog files in
//  src/core/rack/catalog_lists).
//
//  Default configuration (most common selective pallet rack setup):
//    • Frame : 14-gauge, 42" deep, 144" high, 96" beam separation
//              (12-ft upright, standard for general warehousing)
//    • Beam  : standard-class, 96" wide  (8-ft beam, fits 2 standard GMA pallets per bay)
//    • Levels: 3 beam levels at holes 18, 36, 54 → elevations 36", 72", 108"
//              Provides ~36" of clear vertical space per pallet level.
// ─────────────────────────────────────────────────────────────────────────────

import { findFrameSpec, findBeamSpec } from './catalogRegistry.js';

/** Unit conversion: inches → metres. */
export const INCH_TO_M = 0.0254;

// ── Default Frame Specification ──────────────────────────────────────────────
//  Source row (frames.csv): gauge=14, depth_in=42, height_in=144, beam_separation_in=96
//  Most common 12-foot selective rack upright for general warehouse use.

export const DEFAULT_FRAME_SPEC = findFrameSpec(144, 42, 96, 'standard');

// ── Default Beam Specification ───────────────────────────────────────────────
//  Source row (beams.csv): width_in=96, capacity_class=standard
//  8-foot beam — the single most common beam length in selective pallet racking.
//  Holds two standard 40"-wide GMA pallets with clearance on each side.

export const DEFAULT_BEAM_SPEC = findBeamSpec(96, 'standard');

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
