// ─────────────────────────────────────────────────────────────────────────────
//  CAD Drawing Renderer
//
//  Renders the current CAD layout into an image Blob suitable for embedding
//  in PDFs, downloading as PNG/JPEG, or other downstream consumers.
//
//  Produces a professional CAD-style drawing with:
//    • Rulers (top & left)
//    • Entity dimensions and inter-element gap measurements
//    • Entity labels
//    • Grid background with origin crosshair
//    • Title block (project metadata strip)
//
//  Text notes (TEXT_NOTE entities) are intentionally excluded.
//
//  Usage:
//    const blob = await renderCADDrawingBlob(layoutStore, { title: 'My Project' });
// ─────────────────────────────────────────────────────────────────────────────

import { EntityType, entityAABB } from '../layout/entities.js';
import {
  paintEntity,
  paintEntityMeasurements,
} from '../layout/renderers.js';
import { drawGrid } from '../gridRenderer.js';
import { drawTopRuler, drawLeftRuler, drawCornerPatch } from '../rulerRenderer.js';
import {
  RULER_SIZE,
  formatWorldValue,
} from '../coordinateSystem.js';

// ── Defaults ────────────────────────────────────────────────────────────────

/** Minimum pixels-per-metre so entities are legible in the output. */
const MIN_ZOOM = 20;
/** Maximum pixels-per-metre to cap output canvas size. */
const MAX_ZOOM = 120;
/** DPI multiplier for crisp output (2 = retina). */
const DEFAULT_SCALE = 2;
/** World-unit padding around entity bounding box for rulers + dimensions. */
const WORLD_PADDING_M = 1.5;
/** Extra screen-px for dimension lines beyond entity edges. */
const DIMENSION_MARGIN_PX = 60;
/** Title block strip height in screen-px (at 1× scale). */
const TITLE_BLOCK_HEIGHT = 48;

// ── Entity type filter (exclude text notes) ─────────────────────────────────

const EXPORTED_TYPES = new Set([
  EntityType.RACK_MODULE,
  EntityType.RACK_LINE,
  EntityType.WALL,
  EntityType.COLUMN,
]);

// ── Rack adjacency helpers (mirrored from renderers.js for standalone use) ──

const RACK_TYPES = new Set([EntityType.RACK_MODULE, EntityType.RACK_LINE]);
const ADJ_EPS = 0.001;
const FRAME_COL_FRAC = 3 / 96;

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
      const frameH = rack.depthM * FRAME_COL_FRAC;
      const bottomY = rack.transform.y + rack.depthM - frameH;
      const key = `${Math.round(rack.transform.x / ADJ_EPS)},${Math.round(bottomY / ADJ_EPS)}`;
      flags.set(rack.id, { skipRightFrame: false, skipBottomFrame: byPos.has(key) });
    } else {
      const frameW = rack.widthM * FRAME_COL_FRAC;
      const rightX = rack.transform.x + rack.widthM - frameW;
      const key = `${Math.round(rightX / ADJ_EPS)},${Math.round(rack.transform.y / ADJ_EPS)}`;
      flags.set(rack.id, { skipRightFrame: byPos.has(key), skipBottomFrame: false });
    }
  }
  return flags;
}

// ── World bounding box ──────────────────────────────────────────────────────

/**
 * Compute the combined world-space AABB of all exportable entities.
 * Returns null if there are no visible entities to export.
 */
function computeWorldBounds(entities) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (const ent of entities) {
    const bb = entityAABB(ent);
    minX = Math.min(minX, bb.minX);
    minY = Math.min(minY, bb.minY);
    maxX = Math.max(maxX, bb.maxX);
    maxY = Math.max(maxY, bb.maxY);
    count++;
  }

  if (count === 0) return null;
  return { minX, minY, maxX, maxY };
}

// ── Title block ─────────────────────────────────────────────────────────────

function drawTitleBlock(ctx, canvasW, canvasH, options) {
  const h = TITLE_BLOCK_HEIGHT;
  const y = canvasH - h;

  // Background
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, y, canvasW, h);

  // Top border
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(canvasW, y + 0.5);
  ctx.stroke();

  // Inner dividers — split into 3 columns
  const col1 = canvasW * 0.5;
  const col2 = canvasW * 0.8;
  ctx.beginPath();
  ctx.moveTo(col1, y);
  ctx.lineTo(col1, canvasH);
  ctx.moveTo(col2, y);
  ctx.lineTo(col2, canvasH);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#1e293b';
  ctx.textBaseline = 'middle';
  const midY = y + h / 2;

  // Column 1: title
  ctx.font = '600 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  const title = options.title || 'Untitled Layout';
  ctx.fillText(title, 12, midY, col1 - 24);

  // Column 2: scale & units
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.fillText('Scale: 1 DU = 1 m  |  Units: metres', col1 + 12, midY, col2 - col1 - 24);

  // Column 3: date & app
  ctx.textAlign = 'right';
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  ctx.fillText(`RackEditor  |  ${dateStr}`, canvasW - 12, midY, canvasW - col2 - 24);
}

// ── Entity label renderer (supplemental, outside entity body) ───────────────

function drawEntityLabels(ctx, entities, cam) {
  ctx.save();
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  for (const ent of entities) {
    if (!ent.label) continue;

    const bb = entityAABB(ent);
    const centerX = cam.x + ((bb.minX + bb.maxX) / 2) * cam.zoom;
    const topY = cam.y + bb.minY * cam.zoom;

    // Background pill for readability
    const textW = ctx.measureText(ent.label).width;
    const pillW = textW + 12;
    const pillH = 16;
    const pillX = centerX - pillW / 2;
    const pillY = topY - pillH - 4;

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    const r = 3;
    ctx.moveTo(pillX + r, pillY);
    ctx.lineTo(pillX + pillW - r, pillY);
    ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + r);
    ctx.lineTo(pillX + pillW, pillY + pillH - r);
    ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH);
    ctx.lineTo(pillX + r, pillY + pillH);
    ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - r);
    ctx.lineTo(pillX, pillY + r);
    ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.fillText(ent.label, centerX, pillY + pillH - 3, pillW - 8);
  }

  ctx.restore();
}

// ── Proxy store for measurement renderer ────────────────────────────────────

/**
 * Creates a lightweight read-only store proxy that the existing
 * `paintEntityMeasurements` function can consume.  The wrapped entity
 * list already has TEXT_NOTE filtered out.
 */
function createReadOnlyStoreProxy(filteredEntities) {
  const selectionSet = new Set(); // nothing selected in export
  return {
    getAll() { return filteredEntities; },
    getSelection() { return selectionSet; },
  };
}

// ── Main render function ────────────────────────────────────────────────────

/**
 * Render the current CAD layout into an image Blob.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]
 * @param {string}  [options.title]          - Drawing title for title block
 * @param {string}  [options.format='png']   - Output MIME subtype ('png' | 'jpeg' | 'webp')
 * @param {number}  [options.quality=0.92]   - Compression quality for lossy formats (0–1)
 * @param {number}  [options.scale]          - DPI multiplier (default 2 for retina)
 * @param {number}  [options.maxWidth=4096]  - Maximum output width in CSS-px (before scale)
 * @param {number}  [options.maxHeight=4096] - Maximum output height in CSS-px (before scale)
 * @returns {Promise<Blob>} Resolves with the rendered image blob
 */
export async function renderCADDrawingBlob(layoutStore, options = {}) {
  const {
    title = 'Untitled Layout',
    format = 'png',
    quality = 0.92,
    scale = DEFAULT_SCALE,
    maxWidth = 4096,
    maxHeight = 4096,
  } = options;

  // ── 1. Collect visible, exportable entities ────────────────────
  const allEntities = layoutStore.getAll();
  const entities = allEntities.filter(
    (e) => e.visible && EXPORTED_TYPES.has(e.type),
  );

  if (entities.length === 0) {
    throw new Error('No visible entities to render.');
  }

  // ── 2. Compute world bounding box ─────────────────────────────
  const wb = computeWorldBounds(entities);
  const worldW = wb.maxX - wb.minX;
  const worldH = wb.maxY - wb.minY;

  // ── 3. Determine zoom (px per metre) to fit content ───────────
  const usableW = maxWidth - RULER_SIZE - DIMENSION_MARGIN_PX * 2;
  const usableH = maxHeight - RULER_SIZE - DIMENSION_MARGIN_PX * 2 - TITLE_BLOCK_HEIGHT;

  const paddedWorldW = worldW + WORLD_PADDING_M * 2;
  const paddedWorldH = worldH + WORLD_PADDING_M * 2;

  let zoom = Math.min(usableW / paddedWorldW, usableH / paddedWorldH);
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

  // ── 4. Compute canvas dimensions ──────────────────────────────
  const contentW = paddedWorldW * zoom;
  const contentH = paddedWorldH * zoom;

  const canvasW = Math.ceil(RULER_SIZE + contentW + DIMENSION_MARGIN_PX);
  const canvasH = Math.ceil(RULER_SIZE + contentH + DIMENSION_MARGIN_PX + TITLE_BLOCK_HEIGHT);

  // ── 5. Build camera ───────────────────────────────────────────
  //  Camera.x/y is the screen offset of world origin (0,0).
  //  We want wb.minX - padding to map to screen RULER_SIZE + margin.
  const cam = {
    x: RULER_SIZE + DIMENSION_MARGIN_PX / 2 - (wb.minX - WORLD_PADDING_M) * zoom,
    y: RULER_SIZE + DIMENSION_MARGIN_PX / 2 - (wb.minY - WORLD_PADDING_M) * zoom,
    zoom,
  };

  // ── 6. Create offscreen canvas ────────────────────────────────
  const physW = Math.ceil(canvasW * scale);
  const physH = Math.ceil(canvasH * scale);
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(physW, physH)
    : createFallbackCanvas(physW, physH);

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // ── 7. Render layers ──────────────────────────────────────────
  const darkMode = false; // always light for professional export

  // 7a. Grid + background
  drawGrid(ctx, canvasW, canvasH, cam, darkMode);

  // 7b. Entities (no text notes, no selection highlighting)
  const adjacency = buildRackAdjacencyFlags(entities);
  for (const ent of entities) {
    paintEntity(
      ctx,
      ent,
      cam,
      false,       // selected = false
      darkMode,
      adjacency.get(ent.id) ?? {},
      null,        // no sub-selected bay
    );
  }

  // 7c. Labels (above entities)
  drawEntityLabels(ctx, entities, cam);

  // 7d. Dimension lines & gap measurements
  const storeProxy = createReadOnlyStoreProxy(entities);
  paintEntityMeasurements(ctx, storeProxy, cam, darkMode);

  // 7e. Rulers (drawn on top of everything except title block)
  drawTopRuler(ctx, canvasW, cam, darkMode);
  drawLeftRuler(ctx, canvasH, cam, darkMode);
  drawCornerPatch(ctx, darkMode);

  // 7f. Title block (bottom strip)
  drawTitleBlock(ctx, canvasW, canvasH, { title });

  // 7g. Drawing border
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, canvasW - 1.5, canvasH - 1.5);

  // ── 8. Export to blob ─────────────────────────────────────────
  const mimeType = `image/${format}`;

  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mimeType, quality });
  }

  // Fallback for HTMLCanvasElement (no OffscreenCanvas)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed.'))),
      mimeType,
      quality,
    );
  });
}

// ── Fallback canvas factory (for environments without OffscreenCanvas) ──────

function createFallbackCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
