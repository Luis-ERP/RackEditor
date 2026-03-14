// ─────────────────────────────────────────────────────────────────────────────
//  Spatial Helpers
//
//  Grid snapping, Bresenham line drawing, and world↔cell conversions
//  that were previously inlined inside CADCanvas.js.
// ─────────────────────────────────────────────────────────────────────────────

/** Default cell size (world-units, 1 m). */
export const CELL_SIZE = 1;

/**
 * Snap a world coordinate to the nearest grid point.
 *
 * @param {number} value      World-space value
 * @param {number} [step=CELL_SIZE]  Grid step
 * @returns {number}
 */
export function snapToGrid(value, step = CELL_SIZE) {
  return Math.round(value / step) * step;
}

/**
 * Snap both X and Y to the grid.
 *
 * @param {number} wx
 * @param {number} wy
 * @param {number} [step=CELL_SIZE]
 * @returns {{ x: number, y: number }}
 */
export function snapPointToGrid(wx, wy, step = CELL_SIZE) {
  return { x: snapToGrid(wx, step), y: snapToGrid(wy, step) };
}

/**
 * Convert world coords to integer cell coords.
 *
 * @param {number} wx
 * @param {number} wy
 * @param {number} [cellSize=CELL_SIZE]
 * @returns {{ x: number, y: number }}
 */
export function worldToCell(wx, wy, cellSize = CELL_SIZE) {
  return { x: Math.floor(wx / cellSize), y: Math.floor(wy / cellSize) };
}

/**
 * Convert cell coords to world-space origin (top-left of cell).
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} [cellSize=CELL_SIZE]
 * @returns {{ x: number, y: number }}
 */
export function cellToWorld(cx, cy, cellSize = CELL_SIZE) {
  return { x: cx * cellSize, y: cy * cellSize };
}

/**
 * Bresenham line between two grid cells → array of {x,y}.
 *
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {{ x: number, y: number }[]}
 */
export function bresenhamLine(x0, y0, x1, y1) {
  const out = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;
  while (true) {
    out.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 <  dx) { err += dx; cy += sy; }
  }
  return out;
}

/**
 * Test if a world point is inside an AABB.
 *
 * @param {number} wx
 * @param {number} wy
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} aabb
 * @returns {boolean}
 */
export function pointInAABB(wx, wy, aabb) {
  return wx >= aabb.minX && wx <= aabb.maxX && wy >= aabb.minY && wy <= aabb.maxY;
}

/**
 * Test if two AABBs overlap.
 *
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} a
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} b
 * @returns {boolean}
 */
export function aabbOverlap(a, b) {
  return a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY;
}
