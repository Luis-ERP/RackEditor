// ─────────────────────────────────────────────────────────────────────────────
//  Layout Service — Public API
//
//  Central structure that handles all CAD layout logic: entity management,
//  placement, removal, movement, selection, hit-testing, snapping, and
//  rendering.  No React dependency — framework-agnostic.
// ─────────────────────────────────────────────────────────────────────────────

// ── Entities ────────────────────────────────────────────────────────────────
export {
  EntityType,
  nextEntityId,
  resetEntityIdCounter,
  createRackModuleEntity,
  createRackLineEntity,
  createWallEntity,
  createColumnEntity,
  createTextNoteEntity,
  entityAABB,
} from './entities.js';

// ── Layout Store ────────────────────────────────────────────────────────────
export { createLayoutStore } from './layoutStore.js';

// ── Spatial Helpers ─────────────────────────────────────────────────────────
export {
  CELL_SIZE,
  snapToGrid,
  snapPointToGrid,
  worldToCell,
  cellToWorld,
  bresenhamLine,
  pointInAABB,
  aabbOverlap,
} from './spatial.js';

// ── Renderers ───────────────────────────────────────────────────────────────
export {
  paintEntity,
  paintAllEntities,
  paintSelectionRect,
} from './renderers.js';
