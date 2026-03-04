// ─────────────────────────────────────────────────────────────────────────────
//  Grid Renderer Service
//
//  Draws the infinite adaptive grid and origin crosshair onto a canvas 2D ctx.
//  Depends only on coordinateSystem for constants and helpers.
// ─────────────────────────────────────────────────────────────────────────────

import {
  gridStepFor,
  visibleWorldRect,
  MAJOR_EVERY,
  MIN_GRID_PX,
  RULER_SIZE,
} from './coordinateSystem';

// ── colour themes ────────────────────────────────────────────────
const LIGHT = {
  bg:    '#f8f9fb',
  minor: '#e2e4e8',
  major: '#c5c8ce',
  origin:'#94a3b8',
};
const DARK = {
  bg:    '#1a1b1e',
  minor: '#2a2c31',
  major: '#3a3d44',
  origin:'#475569',
};

/**
 * Draw background, grid lines, and origin crosshair.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} screenW  CSS-pixel width
 * @param {number} screenH  CSS-pixel height
 * @param {{x:number, y:number, zoom:number}} cam
 * @param {boolean} [dark=false]
 */
export function drawGrid(ctx, screenW, screenH, cam, dark = false) {
  const theme = dark ? DARK : LIGHT;
  const { x: cx, y: cy, zoom } = cam;

  // 1. background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, screenW, screenH);

  const gridStep  = gridStepFor(zoom);
  const majorStep = gridStep * MAJOR_EVERY;
  const vr        = visibleWorldRect(cam, screenW, screenH);

  // helper: batch-draw one set of lines
  const lines = (step, color, lw) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = lw;
    ctx.beginPath();

    let wx = Math.floor(vr.left / step) * step;
    for (; wx <= vr.right; wx += step) {
      const sx = cx + wx * zoom;
      ctx.moveTo(sx, RULER_SIZE);
      ctx.lineTo(sx, screenH);
    }

    let wy = Math.floor(vr.top / step) * step;
    for (; wy <= vr.bottom; wy += step) {
      const sy = cy + wy * zoom;
      ctx.moveTo(RULER_SIZE, sy);
      ctx.lineTo(screenW, sy);
    }
    ctx.stroke();
    ctx.restore();
  };

  // minor grid
  lines(gridStep, theme.minor, 0.5);

  // major grid (only if screen-spacing is large enough)
  if (majorStep * zoom >= MIN_GRID_PX) {
    lines(majorStep, theme.major, 1);
  }

  // 2. origin crosshair (dashed)
  ctx.save();
  ctx.strokeStyle = theme.origin;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, RULER_SIZE); ctx.lineTo(cx, screenH);
  ctx.moveTo(RULER_SIZE, cy); ctx.lineTo(screenW, cy);
  ctx.stroke();
  ctx.restore();
}
