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
 * For each rack entity, determine whether it has a directly adjacent rack
 * to its right (same Y, touching right edge).  Returns a Map<id, flags>.
 *
 * @param {Object[]} entities
 * @returns {Map<string, { skipRightFrame: boolean }>}
 */
function buildRackAdjacencyFlags(entities) {
  const racks = entities.filter((e) => RACK_TYPES.has(e.type) && e.visible);

  // Index racks by their top-left position (rounded to 1 mm) for O(1) lookup
  const byPos = new Map();
  for (const rack of racks) {
    const key = `${Math.round(rack.transform.x / ADJ_EPS)},${Math.round(rack.transform.y / ADJ_EPS)}`;
    byPos.set(key, rack);
  }

  const flags = new Map();
  for (const rack of racks) {
    // Adjacent bay starts at x + widthM - frameWidth (one frame width closer than a non-adjacent bay).
    // FRAME_COL_FRAC = 3/96, so frameWidth = widthM * FRAME_COL_FRAC.
    const frameW = rack.widthM * FRAME_COL_FRAC;
    const rightX = rack.transform.x + rack.widthM - frameW;
    const y      = rack.transform.y;
    const key    = `${Math.round(rightX / ADJ_EPS)},${Math.round(y / ADJ_EPS)}`;
    flags.set(rack.id, { skipRightFrame: byPos.has(key) });
  }
  return flags;
}

// ── Rack Module / Rack Line ─────────────────────────────────────────────────

function paintRackBox(ctx, entity, cam, selected, dk, { skipRightFrame = false } = {}) {
  const p = pal(dk).rack;
  const { x, y } = entity.transform;
  const sx = cam.x + x * cam.zoom;
  const sy = cam.y + y * cam.zoom;
  const sw = entity.widthM * cam.zoom;
  const sh = entity.depthM * cam.zoom;
  if (sw < 0.5 || sh < 0.5) return;

  // Frame column width and beam strip height (screen pixels, minimum 2 px for visibility)
  const fcw = Math.max(2, sw * FRAME_COL_FRAC);
  const bsh = Math.max(2, sh * BEAM_H_FRAC);

  ctx.save();

  // ── Beams (top & bottom orange strips) ───────────────────────
  ctx.fillStyle = selected ? p.selBeamColor : p.beamColor;
  ctx.fillRect(sx + fcw, sy,            sw - 2 * fcw, bsh);   // top beam
  ctx.fillRect(sx + fcw, sy + sh - bsh, sw - 2 * fcw, bsh);   // bottom beam

  // ── Frame uprights (left & right blue columns) ────────────────
  ctx.fillStyle = selected ? p.selFrameColor : p.frameColor;
  ctx.fillRect(sx, sy, fcw, sh);   // left frame — always drawn
  if (!skipRightFrame) {
    ctx.fillRect(sx + sw - fcw, sy, fcw, sh);   // right frame
  }

  // Frame upright borders
  ctx.strokeStyle = selected ? p.selBorder : p.frameStroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, sy, fcw, sh);
  if (!skipRightFrame) {
    ctx.strokeRect(sx + sw - fcw, sy, fcw, sh);
  }

  // ── Label (centre of bay interior) ───────────────────────────
  const innerW = sw - 2 * fcw;
  const innerH = sh - 2 * bsh;
  if (innerW > 30 && innerH > 12 && entity.label) {
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = selected ? p.selLabel : p.labelColor;
    ctx.font = `${Math.max(8, Math.min(11, innerW * 0.07))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.label, sx + fcw + innerW / 2, sy + bsh + innerH / 2, innerW - 4);
  }

  ctx.restore();
}

// ── Wall ────────────────────────────────────────────────────────────────────

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

  ctx.fillStyle = selected ? p.selFill : p.fill;
  ctx.fillRect(sx, sy - sh / 2, sw, sh);

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
