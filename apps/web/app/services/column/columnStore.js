// ─────────────────────────────────────────────────────────────────────────────
//  Column Store
//
//  Lightweight, framework-agnostic store that holds default column dimensions
//  used when placing new warehouse columns on the canvas.
//
//  Common warehouse structural column sizes:
//    • Concrete: 300 × 300 mm, 400 × 400 mm, 500 × 500 mm
//    • Steel W-shape: W10×49 (254 mm), W12×65 (305 mm), W14×90 (356 mm)
//  Default: 0.4 m × 0.4 m (400 × 400 mm) — typical concrete warehouse column.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new ColumnStore instance.
 *
 * @returns {ColumnStore}
 */
export function createColumnStore() {
  let _defaultWidth = 0.4;   // metres
  let _defaultDepth = 0.4;   // metres

  /** @type {Function[]} */
  const _listeners = [];

  function _notify() {
    for (const fn of _listeners) fn();
  }

  // ── Subscription ──────────────────────────────────────────

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

  // ── Getters / Setters ─────────────────────────────────────

  /** @returns {number} */
  function getDefaultWidth() { return _defaultWidth; }

  /** @returns {number} */
  function getDefaultDepth() { return _defaultDepth; }

  /**
   * @param {number} w — column width in metres (0 < w ≤ 5)
   */
  function setDefaultWidth(w) {
    if (typeof w !== 'number' || w <= 0 || w > 5) return;
    _defaultWidth = w;
    _notify();
  }

  /**
   * @param {number} d — column depth in metres (0 < d ≤ 5)
   */
  function setDefaultDepth(d) {
    if (typeof d !== 'number' || d <= 0 || d > 5) return;
    _defaultDepth = d;
    _notify();
  }

  // ── Public API ────────────────────────────────────────────

  return {
    subscribe,
    getDefaultWidth,
    getDefaultDepth,
    setDefaultWidth,
    setDefaultDepth,
  };
}
