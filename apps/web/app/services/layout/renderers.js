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
    rack:       { fill: '#dbeafe', stroke: '#3b82f6', selFill: '#fef08a', selStroke: '#ca8a04' },
    wall:       { fill: '#d1d5db', stroke: '#6b7280', selFill: '#fef08a', selStroke: '#ca8a04' },
    column:     { fill: '#e5e7eb', stroke: '#4b5563', selFill: '#fef08a', selStroke: '#ca8a04' },
    textNote:   { color: '#1f2937', selColor: '#ca8a04' },
    selRect:    { fill: 'rgba(59,130,246,0.08)', stroke: '#3b82f6' },
  },
  dark: {
    rack:       { fill: '#1e3a5f', stroke: '#3b82f6', selFill: '#854d0e44', selStroke: '#ca8a04' },
    wall:       { fill: '#374151', stroke: '#9ca3af', selFill: '#854d0e44', selStroke: '#ca8a04' },
    column:     { fill: '#4b5563', stroke: '#d1d5db', selFill: '#854d0e44', selStroke: '#ca8a04' },
    textNote:   { color: '#e5e7eb', selColor: '#ca8a04' },
    selRect:    { fill: 'rgba(59,130,246,0.12)', stroke: '#3b82f6' },
  },
};

function pal(dk) { return dk ? PALETTE.dark : PALETTE.light; }

// ── Rack Module / Rack Line ─────────────────────────────────────────────────

function paintRackBox(ctx, entity, cam, selected, dk) {
  const p = pal(dk).rack;
  const { x, y } = entity.transform;
  const sx = cam.x + x * cam.zoom;
  const sy = cam.y + y * cam.zoom;
  const sw = entity.widthM * cam.zoom;
  const sh = entity.depthM * cam.zoom;
  if (sw < 0.5 || sh < 0.5) return;

  ctx.save();

  // Fill
  ctx.fillStyle = selected ? p.selFill : p.fill;
  ctx.fillRect(sx, sy, sw, sh);

  // Border
  ctx.strokeStyle = selected ? p.selStroke : p.stroke;
  ctx.lineWidth = selected ? Math.min(2.5, sw * 0.04) : Math.min(2, sw * 0.03);
  ctx.strokeRect(sx, sy, sw, sh);

  // Shelf lines (visual detail when zoomed in)
  if (sh > 16) {
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = selected ? p.selStroke : p.stroke;
    const levels = 3;
    for (let i = 1; i <= levels; i++) {
      const ly = sy + (sh / (levels + 1)) * i;
      ctx.beginPath();
      ctx.moveTo(sx + 2, ly);
      ctx.lineTo(sx + sw - 2, ly);
      ctx.stroke();
    }
  }

  // Label (when enough room)
  if (sw > 40 && sh > 20 && entity.label) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = selected ? p.selStroke : p.stroke;
    ctx.font = `${Math.max(9, Math.min(12, sw * 0.08))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.label, sx + sw / 2, sy + sh / 2, sw - 8);
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
export function paintEntity(ctx, entity, cam, selected, dk) {
  if (!entity.visible) return;

  switch (entity.type) {
    case EntityType.RACK_MODULE:
    case EntityType.RACK_LINE:
      paintRackBox(ctx, entity, cam, selected, dk);
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
  for (const ent of store.getAll()) {
    paintEntity(ctx, ent, cam, selection.has(ent.id), dk);
  }
}
