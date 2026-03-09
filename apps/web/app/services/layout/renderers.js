// ─────────────────────────────────────────────────────────────────────────────
//  Entity Renderers
//
//  Pure painting functions — one per entity type.  Each receives a canvas 2D
//  context, the entity, the camera state, and whether the entity is selected.
//  The CADCanvas component calls these; no DOM or React dependency here.
// ─────────────────────────────────────────────────────────────────────────────

import { EntityType } from './entities.js';

// ── Color palettes (light / dark) ───────────────────────────────────────────

const PALETTE = {
  light: {
    rack: {
      bayFill:       '#eff6ff',   // bay interior — blue-50
      frameColor:    '#93c5fd',   // upright columns — blue-300
      frameStroke:   '#3b82f6',   // upright border  — blue-500
      beamColor:     '#fb923c',   // beam strips     — orange-400
      border:        '#1d4ed8',   // outer entity border — blue-700
      labelColor:    '#1e40af',   // label text
      // selected variants
      selBayFill:    '#fef9c3',
      selFrameColor: '#fcd34d',
      selBeamColor:  '#f59e0b',
      selBorder:     '#92400e',
      selLabel:      '#92400e',
    },
    wall:       { fill: '#d1d5db', stroke: '#6b7280', selFill: '#fef08a', selStroke: '#ca8a04' },
    column:     { fill: '#e5e7eb', stroke: '#4b5563', selFill: '#fef08a', selStroke: '#ca8a04' },
    textNote:   { color: '#1f2937', selColor: '#ca8a04' },
    selRect:    { fill: 'rgba(59,130,246,0.08)', stroke: '#3b82f6' },
  },
  dark: {
    rack: {
      bayFill:       '#0f172a',
      frameColor:    '#1d4ed8',
      frameStroke:   '#3b82f6',
      beamColor:     '#ea580c',
      border:        '#3b82f6',
      labelColor:    '#93c5fd',
      selBayFill:    '#422006',
      selFrameColor: '#d97706',
      selBeamColor:  '#b45309',
      selBorder:     '#f59e0b',
      selLabel:      '#fcd34d',
    },
    wall:       { fill: '#374151', stroke: '#9ca3af', selFill: '#854d0e44', selStroke: '#ca8a04' },
    column:     { fill: '#4b5563', stroke: '#d1d5db', selFill: '#854d0e44', selStroke: '#ca8a04' },
    textNote:   { color: '#e5e7eb', selColor: '#ca8a04' },
    selRect:    { fill: 'rgba(59,130,246,0.12)', stroke: '#3b82f6' },
  },
};

// Proportional fractions derived from standard rack dimensions (3" column / 96" bay, 5" beam / 42" depth)
const FRAME_COL_FRAC = 3 / 96;   // ≈ 0.031 — upright column width as fraction of bay width
const BEAM_H_FRAC    = 5 / 42;   // ≈ 0.119 — beam strip height as fraction of frame depth

function pal(dk) { return dk ? PALETTE.dark : PALETTE.light; }

// ── Rack adjacency helpers ───────────────────────────────────────────────────

const RACK_TYPES = new Set([EntityType.RACK_MODULE, EntityType.RACK_LINE]);
const ADJ_EPS = 0.001; // 1 mm tolerance for floating-point position comparison

/**
 * For each rack entity, determine adjacency flags for shared-frame rendering.
 * Horizontal: check for adjacent rack to the right (skipRightFrame).
 * Vertical:   check for adjacent rack below (skipBottomFrame).
 *
 * @param {Object[]} entities
 * @returns {Map<string, { skipRightFrame: boolean, skipBottomFrame: boolean }>}
 */
function buildRackAdjacencyFlags(entities) {
  const racks = entities.filter((e) => RACK_TYPES.has(e.type) && e.visible);

  const byPos = new Map();
  for (const rack of racks) {
    const key = `${Math.round(rack.transform.x / ADJ_EPS)},${Math.round(rack.transform.y / ADJ_EPS)}`;
    byPos.set(key, rack);
  }

  const flags = new Map();
  for (const rack of racks) {
    if (rack.transform.rotation === 90) {
      // Vertical: adjacent bay below shares the bottom upright.
      // depthM is the Y extent; frame strip = depthM * FRAME_COL_FRAC.
      const frameH  = rack.depthM * FRAME_COL_FRAC;
      const bottomY = rack.transform.y + rack.depthM - frameH;
      const key     = `${Math.round(rack.transform.x / ADJ_EPS)},${Math.round(bottomY / ADJ_EPS)}`;
      flags.set(rack.id, { skipRightFrame: false, skipBottomFrame: byPos.has(key) });
    } else {
      // Horizontal: adjacent bay to the right shares the right upright.
      const frameW = rack.widthM * FRAME_COL_FRAC;
      const rightX = rack.transform.x + rack.widthM - frameW;
      const key    = `${Math.round(rightX / ADJ_EPS)},${Math.round(rack.transform.y / ADJ_EPS)}`;
      flags.set(rack.id, { skipRightFrame: byPos.has(key), skipBottomFrame: false });
    }
  }
  return flags;
}

// ── Rack Module / Rack Line ─────────────────────────────────────────────────

function paintRackBox(ctx, entity, cam, selected, dk, { skipRightFrame = false, skipBottomFrame = false } = {}) {
  const p = pal(dk).rack;
  const { x, y } = entity.transform;
  const sx = cam.x + x * cam.zoom;
  const sy = cam.y + y * cam.zoom;
  const sw = entity.widthM * cam.zoom;   // visual width  in screen px
  const sh = entity.depthM * cam.zoom;   // visual height in screen px
  if (sw < 0.5 || sh < 0.5) return;

  const isVertical = entity.transform.rotation === 90;

  ctx.save();

  // For vertical racks, rotate the canvas 90° CW around the visual top-right corner
  // (sx+sw, sy).  Under this transform a local point (lx, ly) maps to screen:
  //   screen_x = sx+sw − ly,  screen_y = sy + lx
  // So local (0, 0)  → visual top-left  (sx, sy)    after offset ✓  [actually →(sx+sw,sy)]
  //    local (sh,  0) → visual bottom-right           ✓
  //    local (0,  sw) → visual top-left    (sx, sy)   ✓
  // We then draw a "horizontal" rack with draw width = sh and draw height = sw,
  // which makes the local left/right uprights appear as visual top/bottom uprights,
  // and the local top/bottom beams appear as visual right/left beams.
  let lw = sw, lh = sh, skipRight = skipRightFrame;
  if (isVertical) {
    // Rotate 90° CW around (sx+sw, sy): local(lx,ly) → screen(sx+sw−ly, sy+lx)
    ctx.translate(sx + sw, sy);
    ctx.rotate(Math.PI / 2);
    lw = sh;             // draw width  = visual height (96" in screen)
    lh = sw;             // draw height = visual width  (42" in screen)
    skipRight = skipBottomFrame;  // local "right frame" = visual "bottom frame"
  } else {
    ctx.translate(sx, sy);
  }

  // ── Single horizontal drawing path ───────────────────────────
  const fcw = Math.max(2, lw * FRAME_COL_FRAC);   // upright column width
  const bsh = Math.max(2, lh * BEAM_H_FRAC);       // beam strip height

  // Beams (top & bottom)
  ctx.fillStyle = selected ? p.selBeamColor : p.beamColor;
  ctx.fillRect(fcw, 0,        lw - 2 * fcw, bsh);
  ctx.fillRect(fcw, lh - bsh, lw - 2 * fcw, bsh);

  // Frame uprights (left & right)
  ctx.fillStyle = selected ? p.selFrameColor : p.frameColor;
  ctx.fillRect(0, 0, fcw, lh);                     // left — always drawn
  if (!skipRight) {
    ctx.fillRect(lw - fcw, 0, fcw, lh);             // right
  }

  // Upright borders
  ctx.strokeStyle = selected ? p.selBorder : p.frameStroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, fcw, lh);
  if (!skipRight) {
    ctx.strokeRect(lw - fcw, 0, fcw, lh);
  }

  // Label
  const innerW = lw - 2 * fcw;
  const innerH = lh - 2 * bsh;
  if (innerW > 30 && innerH > 12 && entity.label) {
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = selected ? p.selLabel : p.labelColor;
    ctx.font = `${Math.max(8, Math.min(11, innerW * 0.07))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.label, fcw + innerW / 2, bsh + innerH / 2, innerW - 4);
  }

  ctx.restore();
}

// ── Wall ────────────────────────────────────────────────────────────────────

/**
 * Draw a stipple-dot texture over a rectangular area (screen-space).
 * Creates the "solid fill with dotted texture" look for walls.
 */
function drawDotTexture(ctx, rx, ry, rw, rh, dk) {
  if (rw < 4 || rh < 4) return;
  const spacing = 6;
  const dotR = 0.7;
  const cols = Math.floor(rw / spacing);
  const rows = Math.floor(rh / spacing);
  if (cols * rows > 5000) return; // perf guard

  ctx.fillStyle = dk ? 'rgba(200,200,200,0.25)' : 'rgba(0,0,0,0.15)';
  for (let c = 1; c <= cols; c++) {
    for (let r = 1; r <= rows; r++) {
      ctx.fillRect(
        rx + c * spacing - dotR,
        ry + r * spacing - dotR,
        dotR * 2,
        dotR * 2,
      );
    }
  }
}

function paintWall(ctx, entity, cam, selected, dk) {
  const p = pal(dk).wall;
  const { x, y, rotation } = entity.transform;
  const sx = cam.x + x * cam.zoom;
  const sy = cam.y + y * cam.zoom;
  const sw = entity.lengthM * cam.zoom;
  const sh = entity.thicknessM * cam.zoom;
  if (sw < 0.5) return;

  ctx.save();

  if (rotation !== 0) {
    ctx.translate(sx, sy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-sx, -sy);
  }

  // Solid fill
  ctx.fillStyle = selected ? p.selFill : p.fill;
  ctx.fillRect(sx, sy - sh / 2, sw, sh);

  // Dotted texture overlay
  drawDotTexture(ctx, sx, sy - sh / 2, sw, sh, dk);

  // Outline
  ctx.strokeStyle = selected ? p.selStroke : p.stroke;
  ctx.lineWidth = Math.min(2, sh * 0.15) || 1;
  ctx.strokeRect(sx, sy - sh / 2, sw, sh);

  ctx.restore();
}

// ── Column ──────────────────────────────────────────────────────────────────

function paintColumn(ctx, entity, cam, selected, dk) {
  const p = pal(dk).column;
  const { x, y } = entity.transform;
  const cx = cam.x + x * cam.zoom;
  const cy = cam.y + y * cam.zoom;
  const hw = (entity.widthM / 2) * cam.zoom;
  const hd = (entity.depthM / 2) * cam.zoom;
  if (hw < 0.5 || hd < 0.5) return;

  ctx.save();

  ctx.fillStyle = selected ? p.selFill : p.fill;
  ctx.strokeStyle = selected ? p.selStroke : p.stroke;
  ctx.lineWidth = selected ? 2 : 1.5;

  if (entity.shape === 'ROUND') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hd, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(cx - hw, cy - hd, hw * 2, hd * 2);
    ctx.strokeRect(cx - hw, cy - hd, hw * 2, hd * 2);
  }

  // Cross-hair in column centre
  if (hw > 4) {
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.4, cy);
    ctx.lineTo(cx + hw * 0.4, cy);
    ctx.moveTo(cx, cy - hd * 0.4);
    ctx.lineTo(cx, cy + hd * 0.4);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Text Note ───────────────────────────────────────────────────────────────

function paintTextNote(ctx, entity, cam, selected, dk) {
  const p = pal(dk).textNote;
  const { x, y, rotation } = entity.transform;
  const sx = cam.x + x * cam.zoom;
  const sy = cam.y + y * cam.zoom;
  const fontSize = entity.fontSizeM * cam.zoom;
  if (fontSize < 3) return;

  ctx.save();

  if (rotation !== 0) {
    ctx.translate(sx, sy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-sx, -sy);
  }

  ctx.fillStyle = selected ? p.selColor : p.color;
  ctx.font = `${Math.max(6, fontSize)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(entity.text, sx, sy);

  ctx.restore();
}

// ── Selection Rectangle ─────────────────────────────────────────────────────

/**
 * Paint a selection rectangle (screen-space coords).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w: number, h: number }|null} rect
 * @param {boolean} dk  dark mode
 */
export function paintSelectionRect(ctx, rect, dk = false) {
  if (!rect) return;
  const p = pal(dk).selRect;
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.fillStyle = p.fill;
  ctx.strokeStyle = p.stroke;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

// ── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Paint a wall-drawing preview (semi-transparent ghost shape during drag).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ mode: 'line'|'rect', startX: number, startY: number, endX: number, endY: number, thicknessM: number }|null} preview
 * @param {{ x: number, y: number, zoom: number }} cam
 * @param {boolean} dk  dark mode
 */
export function paintWallPreview(ctx, preview, cam, dk) {
  if (!preview) return;
  const { mode, startX, startY, endX, endY, thicknessM } = preview;
  const p = pal(dk).wall;

  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  ctx.fillStyle = p.fill;
  ctx.strokeStyle = p.stroke;

  if (mode === 'line') {
    const dx  = endX - startX;
    const dy  = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) { ctx.restore(); return; }
    const angle = Math.atan2(dy, dx);
    const sx = cam.x + startX * cam.zoom;
    const sy = cam.y + startY * cam.zoom;
    const sw = len * cam.zoom;
    const sh = thicknessM * cam.zoom;

    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.fillRect(0, -sh / 2, sw, sh);
    ctx.strokeRect(0, -sh / 2, sw, sh);
  } else if (mode === 'rect') {
    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const maxX = Math.max(startX, endX);
    const maxY = Math.max(startY, endY);
    const w = maxX - minX;
    const h = maxY - minY;
    if (w < 0.01 && h < 0.01) { ctx.restore(); return; }

    const t    = thicknessM * cam.zoom;
    const sMinX = cam.x + minX * cam.zoom;
    const sMinY = cam.y + minY * cam.zoom;
    const sW    = w * cam.zoom;
    const sH    = h * cam.zoom;

    // Top wall
    if (w >= 0.01) {
      ctx.fillRect(sMinX, sMinY - t / 2, sW, t);
      ctx.strokeRect(sMinX, sMinY - t / 2, sW, t);
    }
    // Bottom wall
    if (w >= 0.01) {
      ctx.fillRect(sMinX, sMinY + sH - t / 2, sW, t);
      ctx.strokeRect(sMinX, sMinY + sH - t / 2, sW, t);
    }
    // Left wall
    if (h >= 0.01) {
      ctx.fillRect(sMinX - t / 2, sMinY, t, sH);
      ctx.strokeRect(sMinX - t / 2, sMinY, t, sH);
    }
    // Right wall
    if (h >= 0.01) {
      ctx.fillRect(sMinX + sW - t / 2, sMinY, t, sH);
      ctx.strokeRect(sMinX + sW - t / 2, sMinY, t, sH);
    }
  }

  ctx.restore();
}

// ── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Paint a single entity.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} entity
 * @param {{ x: number, y: number, zoom: number }} cam
 * @param {boolean} selected
 * @param {boolean} dk  dark mode
 */
export function paintEntity(ctx, entity, cam, selected, dk, flags = {}) {
  if (!entity.visible) return;

  switch (entity.type) {
    case EntityType.RACK_MODULE:
    case EntityType.RACK_LINE:
      paintRackBox(ctx, entity, cam, selected, dk, flags);
      break;
    case EntityType.WALL:
      paintWall(ctx, entity, cam, selected, dk);
      break;
    case EntityType.COLUMN:
      paintColumn(ctx, entity, cam, selected, dk);
      break;
    case EntityType.TEXT_NOTE:
      paintTextNote(ctx, entity, cam, selected, dk);
      break;
    default:
      break;
  }
}

/**
 * Paint all entities in a layout store.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./layoutStore.js').LayoutStore} store
 * @param {{ x: number, y: number, zoom: number }} cam
 * @param {boolean} dk  dark mode
 */
export function paintAllEntities(ctx, store, cam, dk) {
  const selection = store.getSelection();
  const all = store.getAll();
  const adjacency = buildRackAdjacencyFlags(all);
  for (const ent of all) {
    paintEntity(ctx, ent, cam, selection.has(ent.id), dk, adjacency.get(ent.id) ?? {});
  }
}
