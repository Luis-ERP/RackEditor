// ─────────────────────────────────────────────────────────────────────────────
//  Entity Renderers
//
//  Pure painting functions — one per entity type.  Each receives a canvas 2D
//  context, the entity, the camera state, and whether the entity is selected.
//  The CADCanvas component calls these; no DOM or React dependency here.
// ─────────────────────────────────────────────────────────────────────────────

import { EntityType, entityAABB } from './entities.js';
import { spacersPerFramePairForHeight } from '../rack/rowSpacerRules.js';

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

function formatMeasureMeters(valueM) {
  const abs = Math.abs(valueM);
  if (abs >= 1) {
    const rounded = Math.round(valueM * 100) / 100;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} m`;
  }
  const cm = valueM * 100;
  const roundedCm = Math.round(cm * 10) / 10;
  return `${Number.isInteger(roundedCm) ? roundedCm : roundedCm.toFixed(1)} cm`;
}

const GAP_MEASURE_EPS = 0.001;
const MIN_OVERLAP_M = 0.05;

function isOrthogonalWall(entity) {
  const normalized = ((entity.transform.rotation % 360) + 360) % 360;
  return normalized % 90 === 0;
}

function supportsAutoGapMeasurement(entity) {
  switch (entity.type) {
    case EntityType.RACK_MODULE:
    case EntityType.RACK_LINE:
    case EntityType.COLUMN:
      return true;
    case EntityType.WALL:
      return isOrthogonalWall(entity);
    default:
      return false;
  }
}

function spanOf(bounds, axis) {
  return axis === 'x'
    ? bounds.maxX - bounds.minX
    : bounds.maxY - bounds.minY;
}

function axisOverlap(aMin, aMax, bMin, bMax) {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

function minimumAxisOverlap(sourceBounds, candidateBounds, axis) {
  const minSpan = Math.min(spanOf(sourceBounds, axis), spanOf(candidateBounds, axis));
  return Math.max(MIN_OVERLAP_M, minSpan * 0.2);
}

function findNearestAxisNeighbor(source, items, axis) {
  const sourceBounds = source.bounds;
  const isHorizontal = axis === 'x';
  let best = null;

  for (const candidate of items) {
    if (candidate.entity.id === source.entity.id) continue;

    const candidateBounds = candidate.bounds;
    const gap = isHorizontal
      ? candidateBounds.minX - sourceBounds.maxX
      : candidateBounds.minY - sourceBounds.maxY;
    if (gap < GAP_MEASURE_EPS) continue;

    const overlap = isHorizontal
      ? axisOverlap(sourceBounds.minY, sourceBounds.maxY, candidateBounds.minY, candidateBounds.maxY)
      : axisOverlap(sourceBounds.minX, sourceBounds.maxX, candidateBounds.minX, candidateBounds.maxX);
    if (overlap < minimumAxisOverlap(sourceBounds, candidateBounds, isHorizontal ? 'y' : 'x')) {
      continue;
    }

    if (!best || gap < best.gap - GAP_MEASURE_EPS || (Math.abs(gap - best.gap) <= GAP_MEASURE_EPS && overlap > best.overlap)) {
      best = {
        entity: candidate.entity,
        gap,
        overlap,
        overlapStart: isHorizontal
          ? Math.max(sourceBounds.minY, candidateBounds.minY)
          : Math.max(sourceBounds.minX, candidateBounds.minX),
        overlapEnd: isHorizontal
          ? Math.min(sourceBounds.maxY, candidateBounds.maxY)
          : Math.min(sourceBounds.maxX, candidateBounds.maxX),
        edgeStart: isHorizontal ? sourceBounds.maxX : sourceBounds.maxY,
        edgeEnd: isHorizontal ? candidateBounds.minX : candidateBounds.minY,
      };
    }
  }

  return best;
}

export function buildAutoGapMeasurements(entities) {
  const measurable = entities
    .filter((entity) => entity.visible && supportsAutoGapMeasurement(entity))
    .map((entity) => ({ entity, bounds: entityAABB(entity) }));

  if (measurable.length < 2) return [];

  const measurements = [];
  const seen = new Set();

  for (const source of measurable) {
    const rightNeighbor = findNearestAxisNeighbor(source, measurable, 'x');
    if (rightNeighbor) {
      const key = `x:${source.entity.id}:${rightNeighbor.entity.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        measurements.push({
          axis: 'x',
          entityId: source.entity.id,
          neighborId: rightNeighbor.entity.id,
          distanceM: rightNeighbor.gap,
          x1: rightNeighbor.edgeStart,
          y1: (rightNeighbor.overlapStart + rightNeighbor.overlapEnd) / 2,
          x2: rightNeighbor.edgeEnd,
          y2: (rightNeighbor.overlapStart + rightNeighbor.overlapEnd) / 2,
        });
      }
    }

    const lowerNeighbor = findNearestAxisNeighbor(source, measurable, 'y');
    if (lowerNeighbor) {
      const key = `y:${source.entity.id}:${lowerNeighbor.entity.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        measurements.push({
          axis: 'y',
          entityId: source.entity.id,
          neighborId: lowerNeighbor.entity.id,
          distanceM: lowerNeighbor.gap,
          x1: (lowerNeighbor.overlapStart + lowerNeighbor.overlapEnd) / 2,
          y1: lowerNeighbor.edgeStart,
          x2: (lowerNeighbor.overlapStart + lowerNeighbor.overlapEnd) / 2,
          y2: lowerNeighbor.edgeEnd,
        });
      }
    }
  }

  return measurements;
}

function drawDimensionLine(ctx, {
  x1,
  y1,
  x2,
  y2,
  text,
  color,
  textBg,
  fontPx = 11,
}) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 18) return;

  const ext = 6;
  const head = 4;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, -ext);
  ctx.lineTo(0, ext);
  ctx.moveTo(len, -ext);
  ctx.lineTo(len, ext);
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();

  // Arrowheads
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(head, -2.5);
  ctx.lineTo(head, 2.5);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(len - head, -2.5);
  ctx.lineTo(len - head, 2.5);
  ctx.closePath();
  ctx.fill();

  // Text background cutout keeps labels readable over dense geometry.
  ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelY = -9;
  const labelW = ctx.measureText(text).width + 10;
  const labelH = fontPx + 4;
  ctx.fillStyle = textBg;
  ctx.fillRect((len - labelW) / 2, labelY - labelH / 2, labelW, labelH);
  ctx.fillStyle = color;
  ctx.fillText(text, len / 2, labelY);

  ctx.restore();
}

function drawOrthogonalDimensions(ctx, {
  left,
  top,
  width,
  height,
  widthText,
  heightText,
  color,
  textBg,
  topOffset = 18,
  rightOffset = 18,
}) {
  if (width >= 0.14) {
    drawDimensionLine(ctx, {
      x1: left,
      y1: top - topOffset,
      x2: left + width,
      y2: top - topOffset,
      text: widthText,
      color,
      textBg,
    });
  }

  if (height >= 0.14) {
    drawDimensionLine(ctx, {
      x1: left + width + rightOffset,
      y1: top,
      x2: left + width + rightOffset,
      y2: top + height,
      text: heightText,
      color,
      textBg,
    });
  }
}

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

/**
 * Derive the back-to-back row count from the entity's rowConfiguration string.
 * Returns 1 for single/unknown configs.
 */
function entityRowCount(entity) {
  switch (entity.rowConfiguration) {
    case 'BACK_TO_BACK_2': return 2;
    case 'BACK_TO_BACK_3': return 3;
    case 'BACK_TO_BACK_4': return 4;
    default:               return 1;
  }
}

/**
 * Draw a single rack row (uprights + beams) starting at local (0, rowOffsetY)
 * in the currently-translated context.
 */
function paintSingleRackRow(ctx, {
  lw, rowH, rowOffsetY, bc, fcw, bsh, skipRight,
  selected, p, subSelectedBayIndex, dk,
}) {
  // Beams (top & bottom)
  ctx.fillStyle = selected ? p.selBeamColor : p.beamColor;
  ctx.fillRect(fcw, rowOffsetY,              lw - 2 * fcw, bsh);
  ctx.fillRect(fcw, rowOffsetY + rowH - bsh, lw - 2 * fcw, bsh);

  // Frame uprights (left & right)
  ctx.fillStyle = selected ? p.selFrameColor : p.frameColor;
  ctx.fillRect(0, rowOffsetY, fcw, rowH);   // left — always drawn
  if (!skipRight) {
    ctx.fillRect(lw - fcw, rowOffsetY, fcw, rowH);
  }

  // Intermediate frames for multi-bay entities
  if (bc > 1) {
    const step = (lw - fcw) / bc;
    for (let i = 1; i < bc; i++) {
      ctx.fillRect(i * step, rowOffsetY, fcw, rowH);
    }
  }

  // Upright borders
  ctx.strokeStyle = selected ? p.selBorder : p.frameStroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, rowOffsetY, fcw, rowH);
  if (!skipRight) {
    ctx.strokeRect(lw - fcw, rowOffsetY, fcw, rowH);
  }
  if (bc > 1) {
    const step = (lw - fcw) / bc;
    for (let i = 1; i < bc; i++) {
      ctx.strokeRect(i * step, rowOffsetY, fcw, rowH);
    }
  }

  // Sub-selected bay highlight
  if (subSelectedBayIndex !== null && !selected) {
    const step = (lw - fcw) / bc;
    const bayLeft  = subSelectedBayIndex * step;
    const bayRight = bayLeft + step + (subSelectedBayIndex === bc - 1 ? fcw : 0);
    ctx.save();
    ctx.fillStyle = dk ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.18)';
    ctx.fillRect(bayLeft, rowOffsetY, bayRight - bayLeft, rowH);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(bayLeft + 1, rowOffsetY + 1, bayRight - bayLeft - 2, rowH - 2);
    ctx.restore();
  }
}

function paintRackBox(ctx, entity, cam, selected, dk, { skipRightFrame = false, skipBottomFrame = false } = {}, subSelectedBayIndex = null) {
  const p = pal(dk).rack;
  const { x, y } = entity.transform;
  const sx = cam.x + x * cam.zoom;
  const sy = cam.y + y * cam.zoom;
  const sw = entity.widthM * cam.zoom;   // visual width  in screen px
  const sh = entity.depthM * cam.zoom;   // visual height in screen px
  if (sw < 0.5 || sh < 0.5) return;

  const isVertical = entity.transform.rotation === 90;

  ctx.save();

  let lw = sw, lh = sh, skipRight = skipRightFrame;
  if (isVertical) {
    ctx.translate(sx + sw, sy);
    ctx.rotate(Math.PI / 2);
    lw = sh;
    lh = sw;
    skipRight = skipBottomFrame;
  } else {
    ctx.translate(sx, sy);
  }

  const bc  = entity.bayCount ?? 1;
  const rowCount   = entityRowCount(entity);
  const spacerIn   = entity.spacerSizeIn ?? 0;

  // Compute per-row height and spacer gap in local drawing pixels
  let rowH, spacerPx;
  if (rowCount > 1 && spacerIn > 0) {
    // total lh = rowCount * rowH + (rowCount - 1) * spacerPx
    // We derive rowH from the single-row proportion:
    //   spacerPx = spacerIn * (INCH_TO_M constant) * cam.zoom
    //   but simpler: spacerPx / lh = spacerPortion
    spacerPx = lh * (spacerIn / (spacerIn * (rowCount - 1) + rowCount * (lh / lw) * (bc / FRAME_COL_FRAC) * FRAME_COL_FRAC)); // fallback below
    // Simpler correct derivation: total depth = rowCount * singleRowDepth + (rowCount-1) * spacerDepth
    // singleRowDepth = (totalDepth - (rowCount-1)*spacerDepth) / rowCount
    // In screen pixels proportionally: spacerPx = (spacerIn / totalDepthIn) * lh
    // totalDepthIn is not directly available, but we know:
    //   totalDepth_m = entity.depthM, spacer_m = spacerIn * 0.0254
    // So spacerPx = (spacerIn * 0.0254 / entity.depthM) * lh  (mapped through the correct axis)
    const totalDepthM = isVertical ? entity.widthM : entity.depthM;
    const spacerM     = spacerIn * 0.0254;
    spacerPx = (spacerM / totalDepthM) * lh;
    rowH     = (lh - spacerPx * (rowCount - 1)) / rowCount;
  } else {
    rowH     = lh;
    spacerPx = 0;
  }

  const fcw = Math.max(2, (lw / bc) * FRAME_COL_FRAC);
  const bsh = Math.max(2, rowH * BEAM_H_FRAC);

  // Paint each row
  for (let r = 0; r < rowCount; r++) {
    const rowOffsetY = r * (rowH + spacerPx);
    paintSingleRackRow(ctx, {
      lw, rowH, rowOffsetY, bc, fcw, bsh, skipRight,
      selected, p, subSelectedBayIndex, dk,
    });
  }

  // Draw spacer indicators between rows.
  // Count scales with frame height (persisted as spacersPerRowPair on entity).
  if (rowCount > 1 && spacerPx > 2) {
    const spacerColor = selected
      ? (dk ? '#fbbf24' : '#f59e0b')
      : (dk ? '#4b5563' : '#d1d5db');
    const fallbackSpacerCount = spacersPerFramePairForHeight(entity.frameHeightIn ?? 144);
    const spacerCount = Math.max(1, Math.round(entity.spacersPerRowPair ?? fallbackSpacerCount));
    const markerStep = Math.min(4, spacerPx / (spacerCount + 1));

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = spacerColor;
    ctx.lineWidth = 1;
    for (let r = 0; r < rowCount - 1; r++) {
      const gapTop    = r * (rowH + spacerPx) + rowH;
      const gapCenter = gapTop + spacerPx / 2;
      const startOffset = -((spacerCount - 1) * markerStep) / 2;
      for (let i = 0; i < spacerCount; i++) {
        const y = gapCenter + startOffset + i * markerStep;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(lw, y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // Label dimensions (computed before restore, used after)
  const innerW = lw - 2 * fcw;
  const innerH = rowH - 2 * bsh;

  ctx.restore();

  // Draw label after restore so text is always horizontal regardless of rack rotation
  const screenInnerW = isVertical ? innerH : innerW;
  const screenInnerH = isVertical ? innerW : innerH;
  if (screenInnerW > 30 && screenInnerH > 12 && entity.label) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = selected ? p.selLabel : p.labelColor;
    ctx.font = `${Math.max(8, Math.min(11, screenInnerW * 0.07))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Position label in the center of the first row
    const firstRowCenterY = isVertical
      ? sy + (rowH / 2) * (sw / lh)
      : sy + rowH / 2;
    ctx.fillText(entity.label, sx + sw / 2, firstRowCenterY, screenInnerW - 4);
    ctx.restore();
  }

  // Row count badge (for B2B)
  if (rowCount > 1) {
    ctx.save();
    const badgeFontSize = Math.max(8, Math.min(10, sw * 0.04));
    const badgeText = `${rowCount}× B2B`;
    ctx.font = `600 ${badgeFontSize}px sans-serif`;
    const badgeW = ctx.measureText(badgeText).width + 8;
    const badgeH = badgeFontSize + 4;
    const badgeX = sx + sw - badgeW - 3;
    const badgeY = sy + sh - badgeH - 3;
    ctx.fillStyle = dk ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.25)';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = dk ? '#fbbf24' : '#92400e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();
  }
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

  // Diagonal X cross spanning the full column — standard structural convention
  if (hw > 2) {
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = Math.max(1, Math.min(1.5, hw * 0.08));
    ctx.beginPath();
    // top-left → bottom-right
    ctx.moveTo(cx - hw, cy - hd);
    ctx.lineTo(cx + hw, cy + hd);
    // top-right → bottom-left
    ctx.moveTo(cx + hw, cy - hd);
    ctx.lineTo(cx - hw, cy + hd);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Text Note ───────────────────────────────────────────────────────────────

const NOTE_BORDER_RADIUS_FRAC = 0.06; // border-radius as fraction of smaller dimension
const RESIZE_HANDLE_PX = 6;

function paintTextNote(ctx, entity, cam, selected, dk) {
  const p = pal(dk).textNote;
  const { x, y, rotation } = entity.transform;
  const sx = cam.x + x * cam.zoom;
  const sy = cam.y + y * cam.zoom;
  const widthM  = entity.widthM ?? 2;
  const heightM = entity.heightM ?? 1;
  const sw = widthM * cam.zoom;
  const sh = heightM * cam.zoom;
  if (sw < 2 || sh < 2) return;

  const fontSize = entity.fontSizeM * cam.zoom;
  const bgColor   = entity.bgColor   || '#fffde7';
  const fontColor = entity.fontColor  || p.color;
  const radius = Math.min(sw, sh) * NOTE_BORDER_RADIUS_FRAC;

  ctx.save();

  if (rotation !== 0) {
    ctx.translate(sx + sw / 2, sy + sh / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
  }

  // Background fill with border radius
  ctx.beginPath();
  ctx.moveTo(sx + radius, sy);
  ctx.lineTo(sx + sw - radius, sy);
  ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + radius);
  ctx.lineTo(sx + sw, sy + sh - radius);
  ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - radius, sy + sh);
  ctx.lineTo(sx + radius, sy + sh);
  ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - radius);
  ctx.lineTo(sx, sy + radius);
  ctx.quadraticCurveTo(sx, sy, sx + radius, sy);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();

  // Border
  ctx.strokeStyle = selected ? (dk ? '#fbbf24' : '#ca8a04') : (dk ? '#555' : '#bbb');
  ctx.lineWidth = selected ? 2 : 1;
  ctx.stroke();

  // Text rendering — wrap within the note box  
  if (fontSize >= 3) {
    const pad = Math.max(4, sw * 0.06);
    const maxTextW = sw - pad * 2;
    const maxTextH = sh - pad * 2;
    if (maxTextW > 4 && maxTextH > 4) {
      ctx.fillStyle = fontColor;
      const clampedFont = Math.max(6, Math.min(fontSize, maxTextH));
      ctx.font = `${clampedFont}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Simple word-wrap
      const lineHeight = clampedFont * 1.25;
      const words = entity.text.split(/\s+/);
      let line = '';
      let ly = sy + pad;

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxTextW && line) {
          ctx.fillText(line, sx + pad, ly, maxTextW);
          ly += lineHeight;
          line = word;
          if (ly + clampedFont > sy + sh - pad) break; // overflow
        } else {
          line = testLine;
        }
      }
      if (line && ly + clampedFont <= sy + sh - pad) {
        ctx.fillText(line, sx + pad, ly, maxTextW);
      }
    }
  }

  // Resize handle (bottom-right corner) — only for selected notes
  if (selected) {
    const hx = sx + sw;
    const hy = sy + sh;
    const hs = RESIZE_HANDLE_PX;
    ctx.fillStyle = dk ? '#fbbf24' : '#ca8a04';
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.strokeStyle = dk ? '#1f2937' : '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }

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
export function paintEntity(ctx, entity, cam, selected, dk, flags = {}, subSelectedBayIndex = null) {
  if (!entity.visible) return;

  switch (entity.type) {
    case EntityType.RACK_MODULE:
    case EntityType.RACK_LINE:
      paintRackBox(ctx, entity, cam, selected, dk, flags, subSelectedBayIndex);
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
export function paintAllEntities(ctx, store, cam, dk, subSel = null) {
  const selection = store.getSelection();
  const all = store.getAll();
  const adjacency = buildRackAdjacencyFlags(all);
  for (const ent of all) {
    const bayIdx = (subSel && ent.id === subSel.entityId) ? subSel.bayIndex : null;
    paintEntity(ctx, ent, cam, selection.has(ent.id), dk, adjacency.get(ent.id) ?? {}, bayIdx);
  }
}

/**
 * Draw CAD-style dimensions for visible entities.
 * Placement strategy (intentional and practical for warehouse layout work):
 * - Racks: width on top, depth on right.
 * - Walls: length parallel to wall (outside), plus thickness at midpoint.
 * - Columns: width on top and depth on right.
 */
export function paintEntityMeasurements(ctx, store, cam, dk) {
  if (!store) return;

  const all = store.getAll().filter((ent) => ent.visible);
  if (all.length === 0) return;

  const textBg = dk ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.92)';
  const baseColor = dk ? '#93c5fd' : '#1d4ed8';
  const highlightColor = dk ? '#fbbf24' : '#b45309';
  const gapColor = dk ? '#5eead4' : '#0f766e';

  let rackOrdinal = 0;
  let columnOrdinal = 0;

  for (const ent of all) {
    if (ent.type === EntityType.RACK_MODULE || ent.type === EntityType.RACK_LINE) {
      const left = cam.x + ent.transform.x * cam.zoom;
      const top = cam.y + ent.transform.y * cam.zoom;
      const width = ent.widthM * cam.zoom;
      const height = ent.depthM * cam.zoom;

      drawOrthogonalDimensions(ctx, {
        left,
        top,
        width,
        height,
        widthText: formatMeasureMeters(ent.widthM),
        heightText: formatMeasureMeters(ent.depthM),
        color: baseColor,
        textBg,
        topOffset: 16 + (rackOrdinal % 2) * 12,
        rightOffset: 16 + (rackOrdinal % 3) * 10,
      });

      rackOrdinal += 1;
      continue;
    }

    if (ent.type === EntityType.COLUMN) {
      const left = cam.x + (ent.transform.x - ent.widthM / 2) * cam.zoom;
      const top = cam.y + (ent.transform.y - ent.depthM / 2) * cam.zoom;
      const width = ent.widthM * cam.zoom;
      const height = ent.depthM * cam.zoom;

      drawOrthogonalDimensions(ctx, {
        left,
        top,
        width,
        height,
        widthText: formatMeasureMeters(ent.widthM),
        heightText: formatMeasureMeters(ent.depthM),
        color: highlightColor,
        textBg,
        topOffset: 14 + (columnOrdinal % 2) * 10,
        rightOffset: 14 + (columnOrdinal % 2) * 10,
      });

      columnOrdinal += 1;
      continue;
    }

    if (ent.type === EntityType.WALL) {
      const x1 = cam.x + ent.transform.x * cam.zoom;
      const y1 = cam.y + ent.transform.y * cam.zoom;
      const angle = (ent.transform.rotation * Math.PI) / 180;
      const lengthPx = ent.lengthM * cam.zoom;
      const thicknessPx = ent.thicknessM * cam.zoom;

      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const nx = -uy;
      const ny = ux;

      const offset = 18;
      const sx1 = x1 + nx * offset;
      const sy1 = y1 + ny * offset;
      const sx2 = sx1 + ux * lengthPx;
      const sy2 = sy1 + uy * lengthPx;

      drawDimensionLine(ctx, {
        x1: sx1,
        y1: sy1,
        x2: sx2,
        y2: sy2,
        text: formatMeasureMeters(ent.lengthM),
        color: baseColor,
        textBg,
      });

      if (thicknessPx >= 8) {
        const midX = x1 + ux * (lengthPx / 2);
        const midY = y1 + uy * (lengthPx / 2);
        drawDimensionLine(ctx, {
          x1: midX - nx * (thicknessPx / 2),
          y1: midY - ny * (thicknessPx / 2),
          x2: midX + nx * (thicknessPx / 2),
          y2: midY + ny * (thicknessPx / 2),
          text: formatMeasureMeters(ent.thicknessM),
          color: highlightColor,
          textBg,
          fontPx: 10,
        });
      }
    }
  }

  for (const measurement of buildAutoGapMeasurements(all)) {
    drawDimensionLine(ctx, {
      x1: cam.x + measurement.x1 * cam.zoom,
      y1: cam.y + measurement.y1 * cam.zoom,
      x2: cam.x + measurement.x2 * cam.zoom,
      y2: cam.y + measurement.y2 * cam.zoom,
      text: formatMeasureMeters(measurement.distanceM),
      color: gapColor,
      textBg,
      fontPx: 10,
    });
  }
}
