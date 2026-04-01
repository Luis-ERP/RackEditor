// ─────────────────────────────────────────────────────────────────────────────
//  Layout Entity Types & Factories
//
//  Every object that can be placed on the CAD canvas is a "layout entity".
//  Each entity stores its CAD-specific attributes (position, rotation, size)
//  separately from any domain/business data (which lives in the rack domain).
//
//  Entity types:
//    RACK_MODULE  – a placed rack module (references rack domain id)
//    RACK_LINE    – a placed rack line   (references rack domain id)
//    WALL         – a linear wall segment
//    COLUMN       – a building column (structural pillar)
//    TEXT_NOTE    – a text annotation
// ─────────────────────────────────────────────────────────────────────────────

let _seq = 0;

/** Generate a unique entity ID. */
export function nextEntityId(prefix = 'ent') {
  return `${prefix}_${++_seq}`;
}

/** Reset ID counter (testing). */
export function resetEntityIdCounter() {
  _seq = 0;
}

// ── Entity Type Enum ────────────────────────────────────────────────────────

export const EntityType = Object.freeze({
  RACK_MODULE: 'RACK_MODULE',
  RACK_LINE:   'RACK_LINE',
  WALL:        'WALL',
  COLUMN:      'COLUMN',
  TEXT_NOTE:    'TEXT_NOTE',
});

// ── Base Transform ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} Transform
 * @property {number} x         - World-space X (metres)
 * @property {number} y         - World-space Y (metres)
 * @property {number} rotation  - Rotation in degrees (0–360)
 */

function baseTransform(x = 0, y = 0, rotation = 0) {
  return { x, y, rotation };
}

// ── Entity Factories ────────────────────────────────────────────────────────

/**
 * Create a placed rack module entity.
 *
 * @param {Object}  p
 * @param {string}  [p.id]
 * @param {number}  p.x
 * @param {number}  p.y
 * @param {number}  [p.rotation=0]
 * @param {string}  p.domainId      - Reference to rack domain RackModule.id
 * @param {number}  p.widthM        - Bay width in metres (derived from domain)
 * @param {number}  p.depthM        - Frame depth in metres (derived from domain)
 * @param {string}  [p.label='']
 * @param {string}  [p.rowConfiguration='SINGLE']
 * @param {number}  [p.spacerSizeIn=6]
 * @param {number}  [p.frameHeightIn]
 * @param {number}  [p.spacersPerRowPair]
 * @returns {Object}
 */
export function createRackModuleEntity({
  id,
  x,
  y,
  rotation = 0,
  domainId,
  widthM,
  depthM,
  label = '',
  bayCount = 1,
  rowConfiguration = 'SINGLE',
  spacerSizeIn = 6,
  frameHeightIn,
  spacersPerRowPair,
}) {
  return {
    id:        id ?? nextEntityId('rm'),
    type:      EntityType.RACK_MODULE,
    transform: baseTransform(x, y, rotation),
    domainId,
    widthM,
    depthM,
    bayCount,
    rowConfiguration,
    spacerSizeIn,
    frameHeightIn,
    spacersPerRowPair,
    label,
    locked:    false,
    visible:   true,
  };
}

/**
 * Create a placed rack line entity.
 *
 * @param {Object}  p
 * @param {string}  [p.id]
 * @param {number}  p.x
 * @param {number}  p.y
 * @param {number}  [p.rotation=0]
 * @param {string}  p.domainId      - Reference to rack domain RackLine.id
 * @param {number}  p.widthM        - Total line width in metres
 * @param {number}  p.depthM        - Depth in metres (single or back-to-back)
 * @param {string}  [p.label='']
 * @returns {Object}
 */
export function createRackLineEntity({
  id, x, y, rotation = 0, domainId, widthM, depthM, label = '',
}) {
  return {
    id:        id ?? nextEntityId('rl'),
    type:      EntityType.RACK_LINE,
    transform: baseTransform(x, y, rotation),
    domainId,
    widthM,
    depthM,
    label,
    locked:    false,
    visible:   true,
  };
}

/**
 * Create a wall entity (defined by start and end points, relative to transform).
 *
 * @param {Object}  p
 * @param {string}  [p.id]
 * @param {number}  p.x           - Origin X
 * @param {number}  p.y           - Origin Y
 * @param {number}  [p.rotation=0]
 * @param {number}  p.lengthM     - Wall length in metres
 * @param {number}  [p.thicknessM=0.2]
 * @param {string}  [p.label='']
 * @returns {Object}
 */
export function createWallEntity({
  id, x, y, rotation = 0, lengthM, thicknessM = 0.2, label = '',
}) {
  if (lengthM <= 0) throw new RangeError('Wall length must be positive.');
  return {
    id:          id ?? nextEntityId('wl'),
    type:        EntityType.WALL,
    transform:   baseTransform(x, y, rotation),
    lengthM,
    thicknessM,
    label,
    locked:      false,
    visible:     true,
  };
}

/**
 * Create a building column entity.
 *
 * @param {Object}  p
 * @param {string}  [p.id]
 * @param {number}  p.x
 * @param {number}  p.y
 * @param {number}  [p.rotation=0]
 * @param {number}  [p.widthM=0.3]
 * @param {number}  [p.depthM=0.3]
 * @param {string}  [p.shape='RECT']  - 'RECT' | 'ROUND'
 * @param {string}  [p.label='']
 * @returns {Object}
 */
export function createColumnEntity({
  id, x, y, rotation = 0, widthM = 0.3, depthM = 0.3, shape = 'RECT', label = '',
}) {
  return {
    id:        id ?? nextEntityId('col'),
    type:      EntityType.COLUMN,
    transform: baseTransform(x, y, rotation),
    widthM,
    depthM,
    shape,
    label,
    locked:    false,
    visible:   true,
  };
}

/**
 * Create a text note entity.
 *
 * @param {Object}  p
 * @param {string}  [p.id]
 * @param {number}  p.x
 * @param {number}  p.y
 * @param {number}  [p.rotation=0]
 * @param {string}  p.text
 * @param {number}  [p.fontSizeM=0.3]  - Font size in world metres
 * @param {number}  [p.widthM=2]       - Note container width in world metres
 * @param {number}  [p.heightM=1]      - Note container height in world metres
 * @param {string}  [p.bgColor='#fffde7']   - Background fill colour
 * @param {string}  [p.fontColor='#1f2937'] - Text colour
 * @param {string}  [p.label='']
 * @returns {Object}
 */
export function createTextNoteEntity({
  id, x, y, rotation = 0, text, fontSizeM = 0.3,
  widthM = 2, heightM = 1,
  bgColor = '#fffde7', fontColor = '#1f2937',
  label = '',
}) {
  if (!text) throw new Error('Text note must have non-empty text.');
  return {
    id:        id ?? nextEntityId('txt'),
    type:      EntityType.TEXT_NOTE,
    transform: baseTransform(x, y, rotation),
    text,
    fontSizeM,
    widthM,
    heightM,
    bgColor,
    fontColor,
    label,
    locked:    false,
    visible:   true,
  };
}

// ── Entity Bounding Box ─────────────────────────────────────────────────────

/**
 * Compute the axis-aligned bounding box (AABB) of an entity in world space.
 * Does NOT account for rotation — returns the unrotated extents from the
 * entity's origin. For hit-testing rotated entities you need OBB checks.
 *
 * @param {Object} entity
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function entityAABB(entity) {
  const { x, y } = entity.transform;

  switch (entity.type) {
    case EntityType.RACK_MODULE:
    case EntityType.RACK_LINE:
      return { minX: x, minY: y, maxX: x + entity.widthM, maxY: y + entity.depthM };

    case EntityType.WALL: {
      const len = entity.lengthM;
      const ht  = entity.thicknessM / 2;
      const rot = entity.transform.rotation;
      if (rot === 0) {
        return { minX: x, minY: y - ht, maxX: x + len, maxY: y + ht };
      }
      // General rotation — compute rotated corners of the wall rectangle
      const rad = (rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const corners = [
        [0, -ht], [len, -ht], [len, ht], [0, ht],
      ];
      let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
      for (const [lx, ly] of corners) {
        const wx = x + lx * cos - ly * sin;
        const wy = y + lx * sin + ly * cos;
        mnX = Math.min(mnX, wx);
        mnY = Math.min(mnY, wy);
        mxX = Math.max(mxX, wx);
        mxY = Math.max(mxY, wy);
      }
      return { minX: mnX, minY: mnY, maxX: mxX, maxY: mxY };
    }

    case EntityType.COLUMN:
      return {
        minX: x - entity.widthM / 2,
        minY: y - entity.depthM / 2,
        maxX: x + entity.widthM / 2,
        maxY: y + entity.depthM / 2,
      };

    case EntityType.TEXT_NOTE:
      return {
        minX: x,
        minY: y,
        maxX: x + (entity.widthM ?? entity.fontSizeM * Math.max(entity.text.length * 0.6, 1)),
        maxY: y + (entity.heightM ?? entity.fontSizeM),
      };

    default:
      return { minX: x, minY: y, maxX: x, maxY: y };
  }
}
