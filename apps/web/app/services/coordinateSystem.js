// ─────────────────────────────────────────────────────────────────────────────
//  Coordinate System Service
//
//  Defines the world-unit model and provides every conversion helper that
//  other components (grid, rulers, objects, snaps, dimensions…) need.
//
//  1 world unit (wu) = 1 metre (m)
//
//  At zoom = 1 (100 %):  1 px = 1 m
//  At zoom = 100:         1 px = 1 cm
// ─────────────────────────────────────────────────────────────────────────────

// ── Unit constants ──────────────────────────────────────────────
export const WORLD_UNIT_LABEL = 'm';
export const WORLD_UNIT_NAME  = 'metre';

// ── Zoom limits ─────────────────────────────────────────────────
export const MIN_ZOOM = 0.005;
export const MAX_ZOOM = 200;

// ── Grid thresholds ─────────────────────────────────────────────
/** Minimum screen-px gap before a grid tier is suppressed. */
export const MIN_GRID_PX  = 8;
/** Grid tier is split when it exceeds this many screen-px. */
export const MAX_GRID_PX  = MIN_GRID_PX * 20;
/** Every Nth minor line drawn as a major line. */
export const MAJOR_EVERY  = 10;

// ── Ruler ──────────────────────────────────────────────────────
/** Pixel thickness of each ruler strip. */
export const RULER_SIZE = 24;

// ─────────────────────────────────────────────────────────────────
//  Coordinate conversions
// ─────────────────────────────────────────────────────────────────

/**
 * Screen pixels → world units.
 * @param {number} sx  Screen x
 * @param {number} sy  Screen y
 * @param {{x:number, y:number, zoom:number}} cam  Camera state
 * @returns {{x:number, y:number}}
 */
export function screenToWorld(sx, sy, cam) {
  return {
    x: (sx - cam.x) / cam.zoom,
    y: (sy - cam.y) / cam.zoom,
  };
}

/**
 * World units → screen pixels.
 * @param {number} wx  World x
 * @param {number} wy  World y
 * @param {{x:number, y:number, zoom:number}} cam  Camera state
 * @returns {{x:number, y:number}}
 */
export function worldToScreen(wx, wy, cam) {
  return {
    x: cam.x + wx * cam.zoom,
    y: cam.y + wy * cam.zoom,
  };
}

/**
 * Convert a world-unit length to screen pixels at the current zoom.
 */
export function worldLengthToScreen(len, zoom) {
  return len * zoom;
}

/**
 * Convert a screen-pixel length to world units at the current zoom.
 */
export function screenLengthToWorld(px, zoom) {
  return px / zoom;
}

// ─────────────────────────────────────────────────────────────────
//  Adaptive grid step
// ─────────────────────────────────────────────────────────────────

/**
 * Compute the minor grid step (in world units) for a given zoom.
 * Steps are always clean powers of 10 (0.01, 0.1, 1, 10, 100 …).
 */
export function gridStepFor(zoom) {
  let step = 1; // 1 m
  while (step * zoom < MIN_GRID_PX  && step < 1e9)  step *= 10;
  while (step * zoom > MAX_GRID_PX  && step > 1e-6) step /= 10;
  return step;
}

// ─────────────────────────────────────────────────────────────────
//  Formatting
// ─────────────────────────────────────────────────────────────────

/**
 * Format a world value for display (rulers, HUD, dimension labels…).
 *
 * ≥ 1000 m  → km   (e.g. "1.5 km")
 * ≥ 1 m     → m    (e.g. "12 m", "1.25 m")
 * ≥ 0.01 m  → cm   (e.g. "50 cm", "2.5 cm")
 *  < 0.01 m → mm   (e.g. "5 mm")
 */
export function formatWorldValue(wu) {
  const abs = Math.abs(wu);

  if (abs >= 1000) {
    const v = wu / 1000;
    const r = Math.round(v * 100) / 100;
    return (Number.isInteger(r) ? r : r.toFixed(2)) + ' km';
  }
  if (abs >= 1) {
    const r = Math.round(wu * 100) / 100;
    return (Number.isInteger(r) ? r : r.toFixed(2)) + ' m';
  }
  if (abs >= 0.01) {
    const cm = wu * 100;
    const r  = Math.round(cm * 10) / 10;
    return (Number.isInteger(r) ? r : r.toFixed(1)) + ' cm';
  }
  const mm = wu * 1000;
  const r  = Math.round(mm * 10) / 10;
  return (Number.isInteger(r) ? r : r.toFixed(1)) + ' mm';
}

// ─────────────────────────────────────────────────────────────────
//  Visible world-extent helpers (for renderers)
// ─────────────────────────────────────────────────────────────────

/**
 * Compute the world-coordinate bounding box currently visible on screen.
 */
export function visibleWorldRect(cam, screenW, screenH) {
  const left   = (0       - cam.x) / cam.zoom;
  const right  = (screenW - cam.x) / cam.zoom;
  const top    = (0       - cam.y) / cam.zoom;
  const bottom = (screenH - cam.y) / cam.zoom;
  return { left, right, top, bottom };
}

// ─────────────────────────────────────────────────────────────────
//  Camera helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Clamp a proposed zoom value within allowed bounds.
 */
export function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/**
 * Apply zoom toward an anchor point, mutating `cam` in-place.
 * @param {{x:number,y:number,zoom:number}} cam
 * @param {number} newZoom   Target zoom (will be clamped)
 * @param {number} anchorX   Screen-space anchor x
 * @param {number} anchorY   Screen-space anchor y
 */
export function zoomToward(cam, newZoom, anchorX, anchorY) {
  const z  = clampZoom(newZoom);
  cam.x    = anchorX - (anchorX - cam.x) * (z / cam.zoom);
  cam.y    = anchorY - (anchorY - cam.y) * (z / cam.zoom);
  cam.zoom = z;
}
