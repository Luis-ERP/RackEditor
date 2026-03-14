// ─────────────────────────────────────────────────────────────────────────────
//  Wall Store — Semantic Model
//
//  Dedicated store for wall-specific properties.  Separated from the layout
//  entity system so that architectural/semantic data (thickness, material,
//  fire-rating, etc.) lives in its own model — mirroring the pattern used
//  by the rack domain.
//
//  The layout entity holds position & visual data; this store holds the
//  "what the wall *is*" data.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} WallProperties
 * @property {number} thicknessM - Wall thickness in metres
 */

/**
 * Create a new WallStore instance.
 *
 * @returns {WallStore}
 */
export function createWallStore() {
  /** Default thickness applied to every new wall (metres). */
  let _defaultThicknessM = 0.2; // 200 mm ≈ 8″

  /** Per-wall thickness overrides.  Key = wall entity ID. */
  const _wallProps = new Map();

  /** @type {Function[]} */
  const _listeners = [];

  // ── Internal helpers ──────────────────────────────────────────

  function _notify() {
    for (const fn of _listeners) fn();
  }

  // ── Subscription ──────────────────────────────────────────────

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

  // ── Default Thickness ─────────────────────────────────────────

  /**
   * Get the default wall thickness (metres).
   * @returns {number}
   */
  function getDefaultThickness() {
    return _defaultThicknessM;
  }

  /**
   * Set the default wall thickness (metres).
   * Only affects walls created *after* this call.
   * @param {number} thicknessM
   */
  function setDefaultThickness(thicknessM) {
    if (thicknessM <= 0) throw new RangeError('Thickness must be positive.');
    _defaultThicknessM = thicknessM;
    _notify();
  }

  // ── Per-wall Properties ───────────────────────────────────────

  /**
   * Get the thickness for a specific wall (falls back to default).
   * @param {string} wallEntityId
   * @returns {number}
   */
  function getThickness(wallEntityId) {
    const props = _wallProps.get(wallEntityId);
    return props?.thicknessM ?? _defaultThicknessM;
  }

  /**
   * Set the thickness for a specific wall.
   * @param {string} wallEntityId
   * @param {number} thicknessM
   */
  function setThickness(wallEntityId, thicknessM) {
    if (thicknessM <= 0) throw new RangeError('Thickness must be positive.');
    let props = _wallProps.get(wallEntityId);
    if (!props) {
      props = { thicknessM };
      _wallProps.set(wallEntityId, props);
    } else {
      props.thicknessM = thicknessM;
    }
    _notify();
  }

  /**
   * Remove per-wall data (e.g. when a wall entity is deleted).
   * @param {string} wallEntityId
   */
  function removeWall(wallEntityId) {
    _wallProps.delete(wallEntityId);
  }

  /**
   * Check whether a wall has a per-wall thickness override.
   * @param {string} wallEntityId
   * @returns {boolean}
   */
  function hasOverride(wallEntityId) {
    return _wallProps.has(wallEntityId);
  }

  // ── Serialization ─────────────────────────────────────────────

  /**
   * Export a serializable snapshot.
   * @returns {{ defaultThicknessM: number, overrides: Object }}
   */
  function snapshot() {
    const overrides = {};
    for (const [id, props] of _wallProps) {
      overrides[id] = { ...props };
    }
    return { defaultThicknessM: _defaultThicknessM, overrides };
  }

  /**
   * Restore from a snapshot.
   * @param {{ defaultThicknessM: number, overrides: Object }} data
   */
  function restore(data) {
    _defaultThicknessM = data.defaultThicknessM ?? 0.2;
    _wallProps.clear();
    if (data.overrides) {
      for (const [id, props] of Object.entries(data.overrides)) {
        _wallProps.set(id, { ...props });
      }
    }
    _notify();
  }

  // ── Public API ────────────────────────────────────────────────

  return {
    subscribe,
    getDefaultThickness,
    setDefaultThickness,
    getThickness,
    setThickness,
    removeWall,
    hasOverride,
    snapshot,
    restore,
  };
}
