// ─────────────────────────────────────────────────────────────────────────────
//  Ruler Renderer Service
//
//  Draws top and left measurement rulers with adaptive ticks/labels.
//  Depends only on coordinateSystem for constants and helpers.
// ─────────────────────────────────────────────────────────────────────────────

import {
  gridStepFor,
  formatWorldValue,
  visibleWorldRect,
  MAJOR_EVERY,
  RULER_SIZE,
} from './coordinateSystem';

// ── colour themes ────────────────────────────────────────────────
const LIGHT = {
  bg:        'rgba(248,249,251,0.94)',
  border:    '#d1d5db',
  tickMinor: '#c4c8d0',
  tickMajor: '#6b7280',
  label:     '#374151',
  origin:    '#3b82f6',
};
const DARK = {
  bg:        'rgba(26,27,30,0.94)',
  border:    '#374151',
  tickMinor: '#4b5563',
  tickMajor: '#9ca3af',
  label:     '#d1d5db',
  origin:    '#60a5fa',
};

const FONT = '9px Inter, system-ui, sans-serif';

// ─────────────────────────────────────────────────────────────────

function tickColor(t, isOrigin, isMajor) {
  if (isOrigin) return t.origin;
  if (isMajor)  return t.tickMajor;
  return t.tickMinor;
}

// ─────────────────────────────────────────────────────────────────
//  Top ruler
// ─────────────────────────────────────────────────────────────────

export function drawTopRuler(ctx, screenW, cam, dark = false) {
  const t = dark ? DARK : LIGHT;
  const { x: cx, zoom } = cam;
  const gridStep = gridStepFor(zoom);
  const vr       = visibleWorldRect(cam, screenW, 0);

  ctx.save();
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, screenW, RULER_SIZE);

  // border
  ctx.strokeStyle = t.border;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER_SIZE - 0.5);
  ctx.lineTo(screenW, RULER_SIZE - 0.5);
  ctx.stroke();

  ctx.font         = FONT;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'center';

  let wx = Math.floor(vr.left / gridStep) * gridStep;
  for (; wx <= vr.right; wx += gridStep) {
    const sx       = cx + wx * zoom;
    const isMajor  = Math.round(wx / gridStep) % MAJOR_EVERY === 0;
    const isOrigin = wx === 0;
    const tickH    = isOrigin ? RULER_SIZE - 1 : isMajor ? 10 : 5;

    ctx.beginPath();
    ctx.strokeStyle = tickColor(t, isOrigin, isMajor);
    ctx.lineWidth   = isOrigin ? 2 : 1;
    ctx.moveTo(sx, RULER_SIZE - tickH);
    ctx.lineTo(sx, RULER_SIZE);
    ctx.stroke();

    if (isMajor) {
      ctx.fillStyle = isOrigin ? t.origin : t.label;
      ctx.fillText(formatWorldValue(Math.round(wx * 1e6) / 1e6), sx, 2);
    }
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
//  Left ruler
// ─────────────────────────────────────────────────────────────────

export function drawLeftRuler(ctx, screenH, cam, dark = false) {
  const t = dark ? DARK : LIGHT;
  const { y: cy, zoom } = cam;
  const gridStep = gridStepFor(zoom);
  const vr       = visibleWorldRect(cam, 0, screenH);

  ctx.save();
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, RULER_SIZE, screenH);

  // border
  ctx.strokeStyle = t.border;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(RULER_SIZE - 0.5, 0);
  ctx.lineTo(RULER_SIZE - 0.5, screenH);
  ctx.stroke();

  ctx.font         = FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'right';

  let wy = Math.floor(vr.top / gridStep) * gridStep;
  for (; wy <= vr.bottom; wy += gridStep) {
    const sy       = cy + wy * zoom;
    const isMajor  = Math.round(wy / gridStep) % MAJOR_EVERY === 0;
    const isOrigin = wy === 0;
    const tickW    = isOrigin ? RULER_SIZE - 1 : isMajor ? 10 : 5;

    ctx.beginPath();
    ctx.strokeStyle = tickColor(t, isOrigin, isMajor);
    ctx.lineWidth   = isOrigin ? 2 : 1;
    ctx.moveTo(RULER_SIZE - tickW, sy);
    ctx.lineTo(RULER_SIZE, sy);
    ctx.stroke();

    if (isMajor) {
      ctx.save();
      ctx.fillStyle = isOrigin ? t.origin : t.label;
      ctx.translate(2, sy);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(formatWorldValue(Math.round(wy * 1e6) / 1e6), 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
//  Corner patch (covers ruler intersection)
// ─────────────────────────────────────────────────────────────────

export function drawCornerPatch(ctx, dark = false) {
  const t = dark ? DARK : LIGHT;
  ctx.save();
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE);
  ctx.strokeStyle = t.border;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(RULER_SIZE - 0.5, 0);           ctx.lineTo(RULER_SIZE - 0.5, RULER_SIZE);
  ctx.moveTo(0, RULER_SIZE - 0.5);           ctx.lineTo(RULER_SIZE, RULER_SIZE - 0.5);
  ctx.stroke();
  ctx.restore();
}
