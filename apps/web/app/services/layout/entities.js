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
 * @returns {Object}
 */
export function createRackModuleEntity({
  id, x, y, rotation = 0, domainId, widthM, depthM, label = '',
}) {
  return {
    id:        id ?? nextEntityId('rm'),
    type:      EntityType.RACK_MODULE,
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
 * @param {string}  [p.label='']
 * @returns {Object}
 */
export function createTextNoteEntity({
  id, x, y, rotation = 0, text, fontSizeM = 0.3, label = '',
}) {
  if (!text) throw new Error('Text note must have non-empty text.');
  return {
    id:        id ?? nextEntityId('txt'),
    type:      EntityType.TEXT_NOTE,
    transform: baseTransform(x, y, rotation),
    text,
    fontSizeM,
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

    case EntityType.WALL:
      return {
        minX: x,
        minY: y - entity.thicknessM / 2,
        maxX: x + entity.lengthM,
        maxY: y + entity.thicknessM / 2,
      };

    case EntityType.COLUMN:
      return {
        minX: x - entity.widthM / 2,
        minY: y - entity.depthM / 2,
        maxX: x + entity.widthM / 2,
        maxY: y + entity.depthM / 2,
      };

    case EntityType.TEXT_NOTE:
      // approximate text bounds (width guessed as 5× font)
      return {
        minX: x,
        minY: y - entity.fontSizeM,
        maxX: x + entity.fontSizeM * Math.max(entity.text.length * 0.6, 1),
        maxY: y,
      };

    default:
      return { minX: x, minY: y, maxX: x, maxY: y };
  }
}
