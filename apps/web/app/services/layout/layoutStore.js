// ─────────────────────────────────────────────────────────────────────────────
//  Layout Store
//
//  Central, framework-agnostic store that manages every entity on the CAD
//  canvas.  Provides create/place, remove, move, rotate, lock, visibility,
//  selection, and undo-friendly snapshot capabilities.
//
//  Designed to work with any renderer — the store owns the data; the canvas
//  component simply reads it and paints.
// ─────────────────────────────────────────────────────────────────────────────

import { entityAABB } from './entities.js';

/**
 * Create a new LayoutStore instance.
 *
 * @returns {LayoutStore}
 */
export function createLayoutStore() {
  /** @type {Map<string, Object>} id → entity */
  const _entities = new Map();

  /** @type {Set<string>} selected entity IDs */
  const _selection = new Set();

  /** @type {Function[]} */
  const _listeners = [];

  // ── Internal helpers ────────────────────────────────────────────

  function _notify() {
    for (const fn of _listeners) fn();
  }

  function _assertExists(id) {
    if (!_entities.has(id)) throw new Error(`Entity "${id}" not found.`);
  }

  // ── Subscription ────────────────────────────────────────────────

  /**
   * Subscribe to store changes.  Returns an unsubscribe function.
   * @param {Function} listener
   * @returns {Function}
   */
  function subscribe(listener) {
    _listeners.push(listener);
    return () => {
      const idx = _listeners.indexOf(listener);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }

  // ── CRUD ────────────────────────────────────────────────────────

  /**
   * Add (place) an entity onto the layout.
   * @param {Object} entity — must have `.id` and `.type`
   * @returns {Object} the placed entity
   */
  function add(entity) {
    if (!entity?.id || !entity?.type) {
      throw new Error('Entity must have id and type.');
    }
    if (_entities.has(entity.id)) {
      throw new Error(`Entity "${entity.id}" already exists.`);
    }
    _entities.set(entity.id, entity);
    _notify();
    return entity;
  }

  /**
   * Remove an entity by ID.
   * Also removes it from the selection if selected.
   * @param {string} id
   */
  function remove(id) {
    _assertExists(id);
    _entities.delete(id);
    _selection.delete(id);
    _notify();
  }

  /**
   * Remove all currently selected entities.
   * @returns {string[]} IDs of removed entities
   */
  function removeSelected() {
    const removed = [..._selection];
    for (const id of removed) _entities.delete(id);
    _selection.clear();
    _notify();
    return removed;
  }

  /**
   * Get entity by ID.
   * @param {string} id
   * @returns {Object|undefined}
   */
  function get(id) {
    return _entities.get(id);
  }

  /**
   * Get all entities as an array (snapshot — safe to iterate).
   * @returns {Object[]}
   */
  function getAll() {
    return [..._entities.values()];
  }

  /**
   * Get all entities of a specific type.
   * @param {string} type  EntityType value
   * @returns {Object[]}
   */
  function getAllByType(type) {
    return getAll().filter((e) => e.type === type);
  }

  /**
   * Total entity count.
   * @returns {number}
   */
  function count() {
    return _entities.size;
  }

  /**
   * Clear the entire store (all entities + selection).
   */
  function clear() {
    _entities.clear();
    _selection.clear();
    _notify();
  }

  // ── Transform Operations ────────────────────────────────────────

  /**
   * Move an entity to an absolute position.
   * @param {string} id
   * @param {number} x
   * @param {number} y
   */
  function moveTo(id, x, y) {
    _assertExists(id);
    const ent = _entities.get(id);
    if (ent.locked) return;
    ent.transform.x = x;
    ent.transform.y = y;
    _notify();
  }

  /**
   * Move an entity by a delta.
   * @param {string} id
   * @param {number} dx
   * @param {number} dy
   */
  function moveBy(id, dx, dy) {
    _assertExists(id);
    const ent = _entities.get(id);
    if (ent.locked) return;
    ent.transform.x += dx;
    ent.transform.y += dy;
    _notify();
  }

  /**
   * Move all selected entities by a delta.
   * @param {number} dx
   * @param {number} dy
   */
  function moveSelectedBy(dx, dy) {
    let changed = false;
    for (const id of _selection) {
      const ent = _entities.get(id);
      if (ent && !ent.locked) {
        ent.transform.x += dx;
        ent.transform.y += dy;
        changed = true;
      }
    }
    if (changed) _notify();
  }

  /**
   * Set rotation for an entity (degrees).
   * @param {string} id
   * @param {number} degrees
   */
  function setRotation(id, degrees) {
    _assertExists(id);
    const ent = _entities.get(id);
    if (ent.locked) return;
    ent.transform.rotation = ((degrees % 360) + 360) % 360;
    _notify();
  }

  /**
   * Rotate by a delta (degrees).
   * @param {string} id
   * @param {number} deltaDeg
   */
  function rotateBy(id, deltaDeg) {
    _assertExists(id);
    const ent = _entities.get(id);
    if (ent.locked) return;
    ent.transform.rotation = ((ent.transform.rotation + deltaDeg) % 360 + 360) % 360;
    _notify();
  }

  // ── Lock / Visibility ───────────────────────────────────────────

  /**
   * Toggle lock state.
   * @param {string} id
   * @param {boolean} [locked]
   */
  function setLocked(id, locked) {
    _assertExists(id);
    _entities.get(id).locked = locked ?? !_entities.get(id).locked;
    _notify();
  }

  /**
   * Toggle visibility.
   * @param {string} id
   * @param {boolean} [visible]
   */
  function setVisible(id, visible) {
    _assertExists(id);
    _entities.get(id).visible = visible ?? !_entities.get(id).visible;
    _notify();
  }

  // ── Update fields ───────────────────────────────────────────────

  /**
   * Patch any non-transform fields on an entity.
   * @param {string} id
   * @param {Object} patch — partial entity fields (id, type, transform excluded)
   */
  function update(id, patch) {
    _assertExists(id);
    const ent = _entities.get(id);
    const forbidden = ['id', 'type', 'transform'];
    for (const key of Object.keys(patch)) {
      if (forbidden.includes(key)) {
        throw new Error(`Cannot update immutable field "${key}" via update(). Use dedicated methods.`);
      }
      ent[key] = patch[key];
    }
    _notify();
  }

  // ── Selection ───────────────────────────────────────────────────

  /**
   * Select entity by ID.
   * @param {string} id
   * @param {boolean} [addToSelection=false] — true to add, false to replace
   */
  function select(id, addToSelection = false) {
    _assertExists(id);
    if (!addToSelection) _selection.clear();
    _selection.add(id);
    _notify();
  }

  /**
   * Deselect entity by ID.
   * @param {string} id
   */
  function deselect(id) {
    if (_selection.delete(id)) _notify();
  }

  /**
   * Clear all selections.
   */
  function deselectAll() {
    if (_selection.size === 0) return;
    _selection.clear();
    _notify();
  }

  /**
   * Toggle selection on an entity.
   * @param {string} id
   */
  function toggleSelect(id) {
    _assertExists(id);
    if (_selection.has(id)) _selection.delete(id);
    else _selection.add(id);
    _notify();
  }

  /**
   * Select all entities whose AABB intersects the given world-space rectangle.
   *
   * @param {{ minX: number, minY: number, maxX: number, maxY: number }} rect
   * @param {boolean} [addToSelection=false]
   */
  function selectByRect(rect, addToSelection = false) {
    if (!addToSelection) _selection.clear();
    for (const ent of _entities.values()) {
      if (!ent.visible) continue;
      const bb = entityAABB(ent);
      // AABB intersection
      if (bb.maxX >= rect.minX && bb.minX <= rect.maxX &&
          bb.maxY >= rect.minY && bb.minY <= rect.maxY) {
        _selection.add(ent.id);
      }
    }
    _notify();
  }

  /**
   * Is entity selected?
   * @param {string} id
   * @returns {boolean}
   */
  function isSelected(id) {
    return _selection.has(id);
  }

  /**
   * Get selected entity IDs.
   * @returns {Set<string>}
   */
  function getSelection() {
    return new Set(_selection);
  }

  /**
   * Get selected entities as an array.
   * @returns {Object[]}
   */
  function getSelectedEntities() {
    return [..._selection].map((id) => _entities.get(id)).filter(Boolean);
  }

  /**
   * Number of selected entities.
   * @returns {number}
   */
  function selectionCount() {
    return _selection.size;
  }

  // ── Hit Testing ─────────────────────────────────────────────────

  /**
   * Find the top-most visible entity at a world-space point.
   * Iterates in reverse insertion order (last added = on top).
   *
   * @param {number} wx
   * @param {number} wy
   * @returns {Object|null}
   */
  function hitTest(wx, wy) {
    const all = getAll().reverse();
    for (const ent of all) {
      if (!ent.visible) continue;
      const bb = entityAABB(ent);
      if (wx >= bb.minX && wx <= bb.maxX && wy >= bb.minY && wy <= bb.maxY) {
        return ent;
      }
    }
    return null;
  }

  // ── Snapshot / Serialization ────────────────────────────────────

  /**
   * Export a serializable snapshot of all entities.
   * @returns {Object[]}
   */
  function snapshot() {
    return getAll().map((ent) => ({
      ...ent,
      transform: { ...ent.transform },
    }));
  }

  /**
   * Restore from a snapshot (replaces all current entities).
   * @param {Object[]} entities
   */
  function restore(entities) {
    _entities.clear();
    _selection.clear();
    for (const ent of entities) {
      _entities.set(ent.id, { ...ent, transform: { ...ent.transform } });
    }
    _notify();
  }

  // ── Public API ──────────────────────────────────────────────────

  return {
    // Subscription
    subscribe,

    // CRUD
    add,
    remove,
    removeSelected,
    get,
    getAll,
    getAllByType,
    count,
    clear,

    // Transform
    moveTo,
    moveBy,
    moveSelectedBy,
    setRotation,
    rotateBy,

    // Lock / Visibility
    setLocked,
    setVisible,

    // Update
    update,

    // Selection
    select,
    deselect,
    deselectAll,
    toggleSelect,
    selectByRect,
    isSelected,
    getSelection,
    getSelectedEntities,
    selectionCount,

    // Hit testing
    hitTest,

    // Snapshot
    snapshot,
    restore,
  };
}
