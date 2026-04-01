// ─────────────────────────────────────────────────────────────────────────────
//  DXF Exporter
//
//  Converts the current RackEditor layout into an ASCII DXF file conforming to
//  the CAD Export File Specification (docs/cad_export_file_spec.md).
//
//  Target format : AutoCAD 2018 / AC1032
//  Units         : meters (1 DU = 1 m)
//  Coordinate    : editor Y-down is flipped to CAD Y-up on export
// ─────────────────────────────────────────────────────────────────────────────

import { EntityType, entityAABB } from '../layout/entities.js';

// ── Constants mirrored from renderers.js ───────────────────────────────────
const FRAME_COL_FRAC = 3 / 96;   // upright column width as fraction of bay width
const BEAM_H_FRAC    = 5 / 42;   // beam strip height as fraction of frame depth
const ADJ_EPS        = 0.001;    // 1 mm tolerance for adjacency detection

// ── DXF lineweight enum values (hundredths of mm, -3 = BYLAYER) ───────────
const LW_BYLAYER = -3;
const LW_13 = 13;
const LW_18 = 18;
const LW_25 = 25;
const LW_30 = 30;
const LW_35 = 35;

// ── Layer definitions ──────────────────────────────────────────────────────
// color: ACI (AutoCAD Color Index). 5=blue, 30=orange, 8=dark-gray, 7=black/white
const LAYER_DEFS = [
  { name: 'RACK_OUTLINE',    color: 5,  ltype: 'CONTINUOUS', lw: LW_35,      plot: 1 },
  { name: 'RACK_FRAME',      color: 5,  ltype: 'CONTINUOUS', lw: LW_25,      plot: 1 },
  { name: 'RACK_BEAM',       color: 30, ltype: 'CONTINUOUS', lw: LW_25,      plot: 1 },
  { name: 'RACK_LABEL',      color: 5,  ltype: 'CONTINUOUS', lw: LW_BYLAYER, plot: 1 },
  { name: 'WALL',            color: 8,  ltype: 'CONTINUOUS', lw: LW_30,      plot: 1 },
  { name: 'COLUMN',          color: 8,  ltype: 'CONTINUOUS', lw: LW_25,      plot: 1 },
  { name: 'ANNOTATION_TEXT', color: 7,  ltype: 'CONTINUOUS', lw: LW_BYLAYER, plot: 1 },
  { name: 'ANNOTATION_DIM',  color: 8,  ltype: 'CONTINUOUS', lw: LW_18,      plot: 1 },
  { name: 'AUX_ORIGIN',      color: 9,  ltype: 'CENTER',     lw: LW_18,      plot: 0 },
  { name: 'AUX_GRID',        color: 9,  ltype: 'CONTINUOUS', lw: LW_13,      plot: 0 },
  { name: 'METADATA',        color: 8,  ltype: 'CONTINUOUS', lw: LW_BYLAYER, plot: 0 },
];

// Light-theme fill true-colors (24-bit RGB as integer, group 420)
const TC = {
  RACK_BAY:    0xeff6ff,  // #eff6ff
  RACK_FRAME:  0x93c5fd,  // #93c5fd
  RACK_BEAM:   0xfb923c,  // #fb923c
  WALL_FILL:   0xd1d5db,  // #d1d5db
  COLUMN_FILL: 0xe5e7eb,  // #e5e7eb
};

// ── Handle generator ───────────────────────────────────────────────────────
let _handle = 0;
function nextHandle() { return (++_handle).toString(16).toUpperCase(); }

// ── DXF line helpers ───────────────────────────────────────────────────────
// Each DXF record is: group-code line + value line, separated by \r\n
function gc(code, value) {
  return `${String(code).padStart(3)} \r\n${value}\r\n`;
}

function fmtCoord(v) {
  // Precision: 6 decimal places → sub-millimetre accuracy
  return v.toFixed(6);
}

// ── Coordinate transform ───────────────────────────────────────────────────
// Editor: X right, Y down.  CAD: X right, Y up.
function cadY(editorY) { return -editorY; }

// Rotate a local offset (lx, ly) by angle_deg clockwise (editor convention),
// then translate to editor origin (ox, oy), then convert to CAD coords.
function rotateAndFlip(lx, ly, angleDeg, ox, oy) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const wx  = ox + lx * cos - ly * sin;
  const wy  = oy + lx * sin + ly * cos;
  return { x: wx, y: cadY(wy) };
}

// CAD rotation angle: editor rotation is CW, CAD is CCW → negate
function cadRotation(editorDeg) {
  return ((-editorDeg) % 360 + 360) % 360;
}

// ── Adjacency flags (shared uprights) ─────────────────────────────────────
function buildAdjacencyFlags(entities) {
  const racks = entities.filter(
    (e) => (e.type === EntityType.RACK_MODULE || e.type === EntityType.RACK_LINE) && e.visible,
  );

  const byPos = new Map();
  for (const rack of racks) {
    const key = `${Math.round(rack.transform.x / ADJ_EPS)},${Math.round(rack.transform.y / ADJ_EPS)}`;
    byPos.set(key, rack);
  }

  const flags = new Map();
  for (const rack of racks) {
    if (rack.transform.rotation === 90) {
      const frameH  = rack.depthM * FRAME_COL_FRAC;
      const bottomY = rack.transform.y + rack.depthM - frameH;
      const key     = `${Math.round(rack.transform.x / ADJ_EPS)},${Math.round(bottomY / ADJ_EPS)}`;
      flags.set(rack.id, { skipRightFrame: false, skipBottomFrame: byPos.has(key) });
    } else {
      const frameW = rack.widthM * FRAME_COL_FRAC;
      const rightX = rack.transform.x + rack.widthM - frameW;
      const key    = `${Math.round(rightX / ADJ_EPS)},${Math.round(rack.transform.y / ADJ_EPS)}`;
      flags.set(rack.id, { skipRightFrame: byPos.has(key), skipBottomFrame: false });
    }
  }
  return flags;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DXF Section Builders
// ═══════════════════════════════════════════════════════════════════════════

// ── HEADER ─────────────────────────────────────────────────────────────────
function buildHeader(extMin, extMax) {
  let s = '';
  s += gc(0,  'SECTION');
  s += gc(2,  'HEADER');

  s += gc(9,  '$ACADVER');
  s += gc(1,  'AC1032');            // AutoCAD 2018

  s += gc(9,  '$INSUNITS');
  s += gc(70, '6');                 // 6 = meters

  s += gc(9,  '$MEASUREMENT');
  s += gc(70, '1');                 // 1 = metric

  s += gc(9,  '$LUNITS');
  s += gc(70, '2');                 // 2 = decimal

  s += gc(9,  '$AUNITS');
  s += gc(70, '0');                 // 0 = decimal degrees

  s += gc(9,  '$EXTMIN');
  s += gc(10, fmtCoord(extMin.x));
  s += gc(20, fmtCoord(extMin.y));
  s += gc(30, '0.0');

  s += gc(9,  '$EXTMAX');
  s += gc(10, fmtCoord(extMax.x));
  s += gc(20, fmtCoord(extMax.y));
  s += gc(30, '0.0');

  s += gc(9,  '$LIMMIN');
  s += gc(10, fmtCoord(extMin.x));
  s += gc(20, fmtCoord(extMin.y));

  s += gc(9,  '$LIMMAX');
  s += gc(10, fmtCoord(extMax.x));
  s += gc(20, fmtCoord(extMax.y));

  s += gc(9,  '$LTSCALE');
  s += gc(40, '1.0');

  s += gc(9,  '$TEXTSTYLE');
  s += gc(7,  'RACKEDITOR_STD');

  s += gc(0,  'ENDSEC');
  return s;
}

// ── TABLES ─────────────────────────────────────────────────────────────────
function buildLinetypeEntry(name, description, pattern) {
  let s = '';
  s += gc(0,   'LTYPE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTableRecord');
  s += gc(100, 'AcDbLinetypeTableRecord');
  s += gc(2,   name);
  s += gc(70,  '0');
  s += gc(3,   description);
  s += gc(72,  '65');             // alignment code A
  if (pattern && pattern.length > 0) {
    s += gc(73, String(pattern.length));
    s += gc(40, pattern.reduce((a, b) => a + Math.abs(b), 0).toFixed(6));
    for (const seg of pattern) {
      s += gc(49, seg.toFixed(6));
      s += gc(74, '0');
    }
  } else {
    s += gc(73, '0');
    s += gc(40, '0.0');
  }
  return s;
}

function buildLayerEntry(def) {
  let s = '';
  s += gc(0,   'LAYER');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTableRecord');
  s += gc(100, 'AcDbLayerTableRecord');
  s += gc(2,   def.name);
  s += gc(70,  '0');              // no flags (layer is on, thawed, etc.)
  s += gc(62,  String(def.color));
  s += gc(6,   def.ltype);
  s += gc(370, String(def.lw));
  s += gc(390, 'F');              // plot-style handle placeholder
  s += gc(290, String(def.plot));
  return s;
}

function buildTables() {
  let s = '';
  s += gc(0, 'SECTION');
  s += gc(2, 'TABLES');

  // ── VPORT ────────────────────────────────────────────
  s += gc(0,   'TABLE');
  s += gc(2,   'VPORT');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTable');
  s += gc(70,  '0');              // no entries
  s += gc(0,   'ENDTAB');

  // ── LTYPE ────────────────────────────────────────────
  s += gc(0,   'TABLE');
  s += gc(2,   'LTYPE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTable');
  s += gc(70,  '3');
  s += buildLinetypeEntry('CONTINUOUS', 'Solid line', []);
  s += buildLinetypeEntry('CENTER',     'Center line',  [1.25, -0.25, 0.0625, -0.25]);
  s += buildLinetypeEntry('HIDDEN',     'Hidden line',  [0.25, -0.125]);
  s += gc(0, 'ENDTAB');

  // ── LAYER ────────────────────────────────────────────
  s += gc(0,   'TABLE');
  s += gc(2,   'LAYER');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTable');
  s += gc(70,  String(LAYER_DEFS.length + 1)); // +1 for layer 0
  // Layer 0 (required)
  s += gc(0,   'LAYER');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTableRecord');
  s += gc(100, 'AcDbLayerTableRecord');
  s += gc(2,   '0');
  s += gc(70,  '0');
  s += gc(62,  '7');
  s += gc(6,   'CONTINUOUS');
  s += gc(370, '-3');
  s += gc(290, '1');
  for (const def of LAYER_DEFS) {
    s += buildLayerEntry(def);
  }
  s += gc(0, 'ENDTAB');

  // ── STYLE ────────────────────────────────────────────
  s += gc(0,   'TABLE');
  s += gc(2,   'STYLE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTable');
  s += gc(70,  '1');
  s += gc(0,   'STYLE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTableRecord');
  s += gc(100, 'AcDbTextStyleTableRecord');
  s += gc(2,   'RACKEDITOR_STD');
  s += gc(70,  '0');
  s += gc(40,  '0.0');           // height 0 = variable
  s += gc(41,  '1.0');           // width factor
  s += gc(50,  '0.0');           // oblique angle
  s += gc(71,  '0');
  s += gc(42,  '0.0');
  s += gc(3,   'Arial');
  s += gc(4,   '');
  s += gc(0,   'ENDTAB');

  // ── VIEW (empty, required) ───────────────────────────
  s += gc(0,   'TABLE');
  s += gc(2,   'VIEW');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTable');
  s += gc(70,  '0');
  s += gc(0,   'ENDTAB');

  // ── UCS (empty, required) ────────────────────────────
  s += gc(0,   'TABLE');
  s += gc(2,   'UCS');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTable');
  s += gc(70,  '0');
  s += gc(0,   'ENDTAB');

  // ── APPID ────────────────────────────────────────────
  s += gc(0,   'TABLE');
  s += gc(2,   'APPID');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTable');
  s += gc(70,  '2');
  s += gc(0,   'APPID');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTableRecord');
  s += gc(100, 'AcDbRegAppTableRecord');
  s += gc(2,   'ACAD');
  s += gc(70,  '0');
  s += gc(0,   'APPID');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTableRecord');
  s += gc(100, 'AcDbRegAppTableRecord');
  s += gc(2,   'RACKEDITOR');
  s += gc(70,  '0');
  s += gc(0,   'ENDTAB');

  // ── DIMSTYLE (minimal, required) ─────────────────────
  s += gc(0,   'TABLE');
  s += gc(2,   'DIMSTYLE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbSymbolTable');
  s += gc(70,  '0');
  s += gc(0,   'ENDTAB');

  s += gc(0, 'ENDSEC');
  return s;
}

// ── BLOCKS ─────────────────────────────────────────────────────────────────
function buildBlocks() {
  let s = '';
  s += gc(0, 'SECTION');
  s += gc(2, 'BLOCKS');

  // *MODEL_SPACE block
  s += gc(0,   'BLOCK');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   '0');
  s += gc(100, 'AcDbBlockBegin');
  s += gc(2,   '*Model_Space');
  s += gc(70,  '0');
  s += gc(10,  '0.0');
  s += gc(20,  '0.0');
  s += gc(30,  '0.0');
  s += gc(3,   '*Model_Space');
  s += gc(1,   '');
  s += gc(0,   'ENDBLK');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   '0');
  s += gc(100, 'AcDbBlockEnd');

  // *PAPER_SPACE block
  s += gc(0,   'BLOCK');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   '0');
  s += gc(100, 'AcDbBlockBegin');
  s += gc(2,   '*Paper_Space');
  s += gc(70,  '0');
  s += gc(10,  '0.0');
  s += gc(20,  '0.0');
  s += gc(30,  '0.0');
  s += gc(3,   '*Paper_Space');
  s += gc(1,   '');
  s += gc(0,   'ENDBLK');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   '0');
  s += gc(100, 'AcDbBlockEnd');

  s += gc(0, 'ENDSEC');
  return s;
}

// ── OBJECTS ─────────────────────────────────────────────────────────────────
function buildObjects() {
  let s = '';
  s += gc(0,   'SECTION');
  s += gc(2,   'OBJECTS');
  // Root dictionary (required by most CAD apps)
  s += gc(0,   'DICTIONARY');
  s += gc(5,   'C');
  s += gc(100, 'AcDbDictionary');
  s += gc(281, '1');
  s += gc(3,   'ACAD_GROUP');
  s += gc(350, 'D');
  s += gc(0,   'DICTIONARY');
  s += gc(5,   'D');
  s += gc(100, 'AcDbDictionary');
  s += gc(281, '1');
  s += gc(0,   'ENDSEC');
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Primitive DXF Entity Builders
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LWPOLYLINE — closed rectangle defined by 4 corners in CAD space.
 * @param {string} layer
 * @param {{ x: number, y: number }[]} vertices  — CAD coords, CCW preferred
 * @param {boolean} [closed=true]
 */
function lwpolyline(layer, vertices, closed = true) {
  let s = '';
  s += gc(0,   'LWPOLYLINE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   layer);
  s += gc(100, 'AcDbPolyline');
  s += gc(90,  String(vertices.length));
  s += gc(70,  closed ? '1' : '0');
  s += gc(38,  '0.0');           // elevation
  for (const v of vertices) {
    s += gc(10, fmtCoord(v.x));
    s += gc(20, fmtCoord(v.y));
  }
  return s;
}

/**
 * LINE segment.
 */
function line(layer, x1, y1, x2, y2) {
  let s = '';
  s += gc(0,   'LINE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   layer);
  s += gc(100, 'AcDbLine');
  s += gc(10,  fmtCoord(x1));
  s += gc(20,  fmtCoord(y1));
  s += gc(30,  '0.0');
  s += gc(11,  fmtCoord(x2));
  s += gc(21,  fmtCoord(y2));
  s += gc(31,  '0.0');
  return s;
}

/**
 * CIRCLE.
 */
function circle(layer, cx, cy, radius) {
  let s = '';
  s += gc(0,   'CIRCLE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   layer);
  s += gc(100, 'AcDbCircle');
  s += gc(10,  fmtCoord(cx));
  s += gc(20,  fmtCoord(cy));
  s += gc(30,  '0.0');
  s += gc(40,  fmtCoord(radius));
  return s;
}

/**
 * ELLIPSE (for non-circular round columns).
 * majorEndX/Y = major-axis endpoint relative to center (CAD coords).
 * ratio = minor/major axis ratio.
 */
function ellipse(layer, cx, cy, majorEndX, majorEndY, ratio) {
  let s = '';
  s += gc(0,   'ELLIPSE');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   layer);
  s += gc(100, 'AcDbEllipse');
  s += gc(10,  fmtCoord(cx));
  s += gc(20,  fmtCoord(cy));
  s += gc(30,  '0.0');
  s += gc(11,  fmtCoord(majorEndX));
  s += gc(21,  fmtCoord(majorEndY));
  s += gc(31,  '0.0');
  s += gc(40,  fmtCoord(ratio));
  s += gc(41,  '0.0');           // start param
  s += gc(42,  String(Math.PI * 2)); // end param (full ellipse)
  return s;
}

/**
 * Solid HATCH fill for a closed polygon.
 * @param {string} layer
 * @param {{ x: number, y: number }[]} vertices  — CAD coords
 * @param {number|null} [trueColor]  — optional 24-bit true color override
 */
function solidHatch(layer, vertices, trueColor = null) {
  let s = '';
  s += gc(0,   'HATCH');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   layer);
  if (trueColor !== null) {
    s += gc(62,  '256');         // 256 = true color
    s += gc(420, String(trueColor));
  }
  s += gc(100, 'AcDbHatch');
  // Hatch elevation & normal
  s += gc(10,  '0.0');
  s += gc(20,  '0.0');
  s += gc(30,  '0.0');
  s += gc(210, '0.0');
  s += gc(220, '0.0');
  s += gc(230, '1.0');
  // Pattern name & flags
  s += gc(2,   'SOLID');
  s += gc(70,  '1');             // 1 = solid fill
  s += gc(71,  '0');             // 0 = not associative
  // Boundary paths
  s += gc(91,  '1');             // 1 boundary path
  s += gc(92,  '1');             // 1 = polyline boundary
  s += gc(72,  '0');             // no bulge values
  s += gc(73,  '1');             // closed
  s += gc(93,  String(vertices.length));
  for (const v of vertices) {
    s += gc(10, fmtCoord(v.x));
    s += gc(20, fmtCoord(v.y));
  }
  s += gc(97,  '0');             // no source boundary objects
  // Pattern definition
  s += gc(75,  '1');             // predefined pattern
  s += gc(76,  '1');             // 1 = pattern type SOLID
  s += gc(52,  '0.0');           // pattern angle
  s += gc(41,  '1.0');           // pattern scale
  s += gc(77,  '0');             // not double
  s += gc(78,  '0');             // 0 hatch lines
  // Seed points
  s += gc(98,  '1');
  // Centroid approximation for seed
  const cx = vertices.reduce((a, v) => a + v.x, 0) / vertices.length;
  const cy = vertices.reduce((a, v) => a + v.y, 0) / vertices.length;
  s += gc(10,  fmtCoord(cx));
  s += gc(20,  fmtCoord(cy));
  return s;
}

/**
 * TEXT entity (single-line).
 * @param {string} layer
 * @param {string} text
 * @param {number} x  CAD insert X
 * @param {number} y  CAD insert Y
 * @param {number} height  text height in metres
 * @param {number} [rotDeg=0]  rotation in CAD degrees (CCW)
 */
function textEntity(layer, text, x, y, height, rotDeg = 0) {
  const safe = toAscii(text);
  if (!safe) return '';
  let s = '';
  s += gc(0,   'TEXT');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   layer);
  s += gc(100, 'AcDbText');
  s += gc(10,  fmtCoord(x));
  s += gc(20,  fmtCoord(y));
  s += gc(30,  '0.0');
  s += gc(40,  fmtCoord(Math.max(height, 0.001)));
  s += gc(1,   safe);
  s += gc(50,  fmtCoord(rotDeg));
  s += gc(7,   'RACKEDITOR_STD');
  s += gc(100, 'AcDbText');
  return s;
}

/**
 * MTEXT entity (multi-line).
 */
function mtextEntity(layer, text, x, y, height, rotDeg = 0) {
  const safe = toAscii(text).replace(/\n/g, '\\P');
  if (!safe) return '';
  let s = '';
  s += gc(0,   'MTEXT');
  s += gc(5,   nextHandle());
  s += gc(100, 'AcDbEntity');
  s += gc(8,   layer);
  s += gc(100, 'AcDbMText');
  s += gc(10,  fmtCoord(x));
  s += gc(20,  fmtCoord(y));
  s += gc(30,  '0.0');
  s += gc(40,  fmtCoord(Math.max(height, 0.001)));
  s += gc(41,  '0.0');           // reference rect width (0 = no wrap)
  s += gc(71,  '1');             // attachment: 1 = top-left
  s += gc(72,  '5');             // drawing direction: left-to-right
  s += gc(1,   safe);
  s += gc(7,   'RACKEDITOR_STD');
  s += gc(50,  fmtCoord(rotDeg));
  return s;
}

// ── ASCII sanitiser ────────────────────────────────────────────────────────
function toAscii(str) {
  if (!str) return '';
  // Transliterate common non-ASCII; drop the rest
  return str
    .replace(/[àáâãäå]/gi, 'a')
    .replace(/[èéêë]/gi,  'e')
    .replace(/[ìíîï]/gi,  'i')
    .replace(/[òóôõö]/gi, 'o')
    .replace(/[ùúûü]/gi,  'u')
    .replace(/ñ/gi,       'n')
    .replace(/ç/gi,       'c')
    .replace(/[^\x20-\x7E\n]/g, '?');
}

// ═══════════════════════════════════════════════════════════════════════════
//  Rect helpers — compute CAD-space corners for an axis-aligned rect
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return 4 CCW vertices for a rect (in CAD coords, Y-up) given:
 *   x0, y0 = editor-space top-left corner
 *   w, h   = width & height in metres (positive)
 * No rotation — use rotatedRectVertices for rotated shapes.
 */
function axisRectVertices(x0, y0, w, h) {
  // Editor TL → CAD BL (Y flipped)
  return [
    { x: x0,     y: cadY(y0 + h) },   // CAD bottom-left
    { x: x0 + w, y: cadY(y0 + h) },   // CAD bottom-right
    { x: x0 + w, y: cadY(y0)     },   // CAD top-right
    { x: x0,     y: cadY(y0)     },   // CAD top-left
  ];
}

/**
 * Return 4 CCW vertices for a rotated rect given:
 *   local corners (in entity-local space), entity origin, and rotation (deg CW).
 */
function rotatedRectVertices(localCorners, ox, oy, rotDeg) {
  return localCorners.map(([lx, ly]) => rotateAndFlip(lx, ly, rotDeg, ox, oy));
}

// ═══════════════════════════════════════════════════════════════════════════
//  Entity → DXF Converters
// ═══════════════════════════════════════════════════════════════════════════

// ── Rack (RACK_MODULE / RACK_LINE) ─────────────────────────────────────────
function exportRack(entity, { skipRightFrame = false, skipBottomFrame = false } = {}) {
  const { x, y, rotation } = entity.transform;
  const { widthM, depthM, label } = entity;
  const isVertical = rotation === 90;

  // Back-to-back row support
  const rowCount = (() => {
    switch (entity.rowConfiguration) {
      case 'BACK_TO_BACK_2': return 2;
      case 'BACK_TO_BACK_3': return 3;
      case 'BACK_TO_BACK_4': return 4;
      default:               return 1;
    }
  })();
  const spacerIn = entity.spacerSizeIn ?? 0;
  const spacerM  = spacerIn * 0.0254;

  let out = '';

  if (isVertical) {
    // Compute per-row height for vertical layout
    const singleRowDepth = rowCount > 1
      ? (depthM - spacerM * (rowCount - 1)) / rowCount
      : depthM;

    for (let r = 0; r < rowCount; r++) {
      const rowY = y + r * (singleRowDepth + spacerM);

      const fh = singleRowDepth * FRAME_COL_FRAC;
      const bw = widthM * BEAM_H_FRAC;

      // Outer boundary per row
      const outerV = axisRectVertices(x, rowY, widthM, singleRowDepth);
      out += solidHatch('RACK_FRAME', outerV, TC.RACK_BAY);
      out += lwpolyline('RACK_OUTLINE', outerV);

      // Top frame strip
      const topV = axisRectVertices(x, rowY, widthM, fh);
      out += solidHatch('RACK_FRAME', topV, TC.RACK_FRAME);
      out += lwpolyline('RACK_FRAME', topV);

      // Bottom frame strip
      const isLastRow = r === rowCount - 1;
      if (!(isLastRow && skipBottomFrame)) {
        const botV = axisRectVertices(x, rowY + singleRowDepth - fh, widthM, fh);
        out += solidHatch('RACK_FRAME', botV, TC.RACK_FRAME);
        out += lwpolyline('RACK_FRAME', botV);
      }

      // Left beam strip
      const lbV = axisRectVertices(x, rowY + fh, bw, singleRowDepth - 2 * fh);
      out += solidHatch('RACK_BEAM', lbV, TC.RACK_BEAM);
      out += lwpolyline('RACK_BEAM', lbV);

      // Right beam strip
      const rbV = axisRectVertices(x + widthM - bw, rowY + fh, bw, singleRowDepth - 2 * fh);
      out += solidHatch('RACK_BEAM', rbV, TC.RACK_BEAM);
      out += lwpolyline('RACK_BEAM', rbV);
    }

    // Label in center of first row
    if (label) {
      const singleRowDepthL = rowCount > 1
        ? (depthM - spacerM * (rowCount - 1)) / rowCount
        : depthM;
      const lx = x + widthM / 2;
      const ly = y + singleRowDepthL / 2;
      out += textEntity('RACK_LABEL', label, lx, cadY(ly), 0.0035, 0);
    }
  } else {
    // Horizontal rack
    const singleRowDepth = rowCount > 1
      ? (depthM - spacerM * (rowCount - 1)) / rowCount
      : depthM;

    for (let r = 0; r < rowCount; r++) {
      const rowY = y + r * (singleRowDepth + spacerM);

      const fcw = widthM * FRAME_COL_FRAC;
      const bsh = singleRowDepth * BEAM_H_FRAC;

      // Outer boundary per row
      const outerV = axisRectVertices(x, rowY, widthM, singleRowDepth);
      out += solidHatch('RACK_FRAME', outerV, TC.RACK_BAY);
      out += lwpolyline('RACK_OUTLINE', outerV);

      // Left upright
      const lfV = axisRectVertices(x, rowY, fcw, singleRowDepth);
      out += solidHatch('RACK_FRAME', lfV, TC.RACK_FRAME);
      out += lwpolyline('RACK_FRAME', lfV);

      // Right upright (skip only on last row if adjacent)
      const isLastRow = r === rowCount - 1;
      if (!(isLastRow && skipRightFrame)) {
        const rfV = axisRectVertices(x + widthM - fcw, rowY, fcw, singleRowDepth);
        out += solidHatch('RACK_FRAME', rfV, TC.RACK_FRAME);
        out += lwpolyline('RACK_FRAME', rfV);
      }

      // Top beam
      const tbV = axisRectVertices(x + fcw, rowY, widthM - 2 * fcw, bsh);
      out += solidHatch('RACK_BEAM', tbV, TC.RACK_BEAM);
      out += lwpolyline('RACK_BEAM', tbV);

      // Bottom beam
      const bbV = axisRectVertices(x + fcw, rowY + singleRowDepth - bsh, widthM - 2 * fcw, bsh);
      out += solidHatch('RACK_BEAM', bbV, TC.RACK_BEAM);
      out += lwpolyline('RACK_BEAM', bbV);
    }

    // Label in center of first row
    if (label) {
      const fcw = widthM * FRAME_COL_FRAC;
      const bsh = singleRowDepth * BEAM_H_FRAC;
      const lx = x + fcw + (widthM - 2 * fcw) / 2;
      const ly = y + bsh + (singleRowDepth - 2 * bsh) / 2;
      out += textEntity('RACK_LABEL', label, lx, cadY(ly), 0.0035, 0);
    }
  }

  return out;
}

// ── Wall ───────────────────────────────────────────────────────────────────
function exportWall(entity) {
  const { x, y, rotation } = entity.transform;
  const { lengthM, thicknessM, label } = entity;
  const ht = thicknessM / 2;

  // Local corners of the wall rectangle (centered on Y at origin):
  // (0, -ht), (len, -ht), (len, ht), (0, ht) — in entity-local space
  const localCorners = [
    [0,       -ht],
    [lengthM, -ht],
    [lengthM,  ht],
    [0,        ht],
  ];

  const vertices = rotatedRectVertices(localCorners, x, y, rotation);

  let out = '';
  out += solidHatch('WALL', vertices, TC.WALL_FILL);
  out += lwpolyline('WALL', vertices);

  if (label) {
    const cadRot = cadRotation(rotation);
    out += textEntity('ANNOTATION_TEXT', label, x, cadY(y), 0.0025, cadRot);
  }

  return out;
}

// ── Column ─────────────────────────────────────────────────────────────────
function exportColumn(entity) {
  const { x, y } = entity.transform;
  const { widthM, depthM, shape, label } = entity;
  const hw = widthM / 2;
  const hd = depthM / 2;

  let out = '';

  if (shape === 'ROUND') {
    const isCircle = Math.abs(widthM - depthM) < 0.001;
    if (isCircle) {
      const r = hw;
      out += solidHatch('COLUMN',
        circleApproxVertices(x, cadY(y), r), TC.COLUMN_FILL);
      out += circle('COLUMN', x, cadY(y), r);
    } else {
      // Ellipse: major axis along X (widthM >= depthM assumed)
      const useMajorX = widthM >= depthM;
      const majorEnd  = useMajorX ? hw : hd;
      const ratio     = useMajorX ? hd / hw : hw / hd;
      const majorEndX = useMajorX ? majorEnd : 0;
      const majorEndY = useMajorX ? 0 : majorEnd;
      out += ellipse('COLUMN', x, cadY(y), majorEndX, majorEndY, ratio);
    }
    // X cross (diagonal lines inscribed in column bounds)
    out += line('COLUMN', x - hw, cadY(y - hd), x + hw, cadY(y + hd));
    out += line('COLUMN', x + hw, cadY(y - hd), x - hw, cadY(y + hd));
  } else {
    // Rectangular column
    const vertices = axisRectVertices(x - hw, y - hd, widthM, depthM);
    out += solidHatch('COLUMN', vertices, TC.COLUMN_FILL);
    out += lwpolyline('COLUMN', vertices);
    // Diagonal X cross
    out += line('COLUMN', x - hw, cadY(y - hd), x + hw, cadY(y + hd));
    out += line('COLUMN', x + hw, cadY(y - hd), x - hw, cadY(y + hd));
  }

  if (label) {
    out += textEntity('ANNOTATION_TEXT', label, x - hw, cadY(y), 0.0025, 0);
  }

  return out;
}

/** Approximate a circle with 16-gon vertices (for hatch boundary). */
function circleApproxVertices(cx, cy, r, segs = 16) {
  const verts = [];
  for (let i = 0; i < segs; i++) {
    const a = (2 * Math.PI * i) / segs;
    verts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return verts;
}

// ── Text Note ──────────────────────────────────────────────────────────────
function exportTextNote(entity) {
  const { x, y, rotation } = entity.transform;
  const { text, fontSizeM } = entity;
  const cadRot = cadRotation(rotation);
  const height = fontSizeM > 0 ? fontSizeM : 0.0025;

  if (!text) return '';

  const isMultiLine = text.includes('\n');
  if (isMultiLine) {
    return mtextEntity('ANNOTATION_TEXT', text, x, cadY(y), height, cadRot);
  }
  return textEntity('ANNOTATION_TEXT', text, x, cadY(y), height, cadRot);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Extents computation
// ─────────────────────────────────────────────────────────────────────────────
function computeExtents(entities) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ent of entities) {
    const bb = entityAABB(ent);
    minX = Math.min(minX, bb.minX);
    maxX = Math.max(maxX, bb.maxX);
    // AABBs are in editor Y-down; convert to CAD Y-up
    minY = Math.min(minY, cadY(bb.maxY));
    maxY = Math.max(maxY, cadY(bb.minY));
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Export Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate an ASCII DXF string from a LayoutStore.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @returns {string}  Complete ASCII DXF content
 */
export function exportToDXF(layoutStore) {
  // Reset handle counter for a fresh export
  _handle = 0;

  const allEntities   = layoutStore.getAll();
  const visibleEnts   = allEntities.filter((e) => e.visible);
  const adjacencyFlags = buildAdjacencyFlags(visibleEnts);

  // Validate entities — skip degenerate ones
  const exportable = visibleEnts.filter((e) => {
    if (isNaN(e.transform.x) || isNaN(e.transform.y)) return false;
    if (e.type === EntityType.WALL && (e.lengthM <= 0 || e.thicknessM <= 0)) return false;
    if ((e.type === EntityType.RACK_MODULE || e.type === EntityType.RACK_LINE) &&
        (e.widthM <= 0 || e.depthM <= 0)) return false;
    if (e.type === EntityType.COLUMN && (e.widthM <= 0 || e.depthM <= 0)) return false;
    return true;
  });

  const extents = computeExtents(exportable);

  // Build ENTITIES section content
  let entitiesBody = '';
  for (const ent of exportable) {
    switch (ent.type) {
      case EntityType.RACK_MODULE:
      case EntityType.RACK_LINE:
        entitiesBody += exportRack(ent, adjacencyFlags.get(ent.id) ?? {});
        break;
      case EntityType.WALL:
        entitiesBody += exportWall(ent);
        break;
      case EntityType.COLUMN:
        entitiesBody += exportColumn(ent);
        break;
      case EntityType.TEXT_NOTE:
        entitiesBody += exportTextNote(ent);
        break;
      default:
        break;
    }
  }

  // Assemble full DXF
  let dxf = '';
  dxf += buildHeader(extents.min, extents.max);
  dxf += buildTables();
  dxf += buildBlocks();

  dxf += gc(0, 'SECTION');
  dxf += gc(2, 'ENTITIES');
  dxf += entitiesBody;
  dxf += gc(0, 'ENDSEC');

  dxf += buildObjects();
  dxf += gc(0, 'EOF');

  return dxf;
}

/**
 * Trigger a browser download of the DXF file.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {string} [filename='rack-layout.dxf']
 */
export function downloadDXF(layoutStore, filename = 'rack-layout.dxf') {
  const content = exportToDXF(layoutStore);
  const blob    = new Blob([content], { type: 'application/dxf' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
