// ─────────────────────────────────────────────────────────────────────────────
//  Note Store
//
//  Lightweight, framework-agnostic store that holds default annotation note
//  properties used when placing new text notes on the canvas.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new NoteStore instance.
 *
 * @returns {NoteStore}
 */
export function createNoteStore() {
  let _defaultBgColor   = '#fffde7';   // warm yellow
  let _defaultFontColor = '#1f2937';   // dark gray
  let _defaultFontSizeM = 0.3;         // metres (world space)
  let _defaultWidthM    = 2;           // metres
  let _defaultHeightM   = 1;           // metres

  /** @type {Function[]} */
  const _listeners = [];

  function _notify() {
    for (const fn of _listeners) fn();
  }

  // ── Subscription ──────────────────────────────────────────

  function subscribe(listener) {
    _listeners.push(listener);
    return () => {
      const idx = _listeners.indexOf(listener);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }

  // ── Getters / Setters ─────────────────────────────────────

  function getDefaultBgColor()   { return _defaultBgColor; }
  function getDefaultFontColor() { return _defaultFontColor; }
  function getDefaultFontSizeM() { return _defaultFontSizeM; }
  function getDefaultWidthM()    { return _defaultWidthM; }
  function getDefaultHeightM()   { return _defaultHeightM; }

  function setDefaultBgColor(c) {
    if (typeof c !== 'string' || !c) return;
    _defaultBgColor = c;
    _notify();
  }

  function setDefaultFontColor(c) {
    if (typeof c !== 'string' || !c) return;
    _defaultFontColor = c;
    _notify();
  }

  function setDefaultFontSizeM(s) {
    if (typeof s !== 'number' || s <= 0 || s > 10) return;
    _defaultFontSizeM = s;
    _notify();
  }

  function setDefaultWidthM(w) {
    if (typeof w !== 'number' || w <= 0 || w > 50) return;
    _defaultWidthM = w;
    _notify();
  }

  function setDefaultHeightM(h) {
    if (typeof h !== 'number' || h <= 0 || h > 50) return;
    _defaultHeightM = h;
    _notify();
  }

  // ── Serialisation ─────────────────────────────────────────

  function snapshot() {
    return {
      defaultBgColor:   _defaultBgColor,
      defaultFontColor: _defaultFontColor,
      defaultFontSizeM: _defaultFontSizeM,
      defaultWidthM:    _defaultWidthM,
      defaultHeightM:   _defaultHeightM,
    };
  }

  function restore(data) {
    if (!data || typeof data !== 'object') return;
    if (typeof data.defaultBgColor   === 'string') _defaultBgColor   = data.defaultBgColor;
    if (typeof data.defaultFontColor === 'string') _defaultFontColor = data.defaultFontColor;
    if (typeof data.defaultFontSizeM === 'number') _defaultFontSizeM = data.defaultFontSizeM;
    if (typeof data.defaultWidthM    === 'number') _defaultWidthM    = data.defaultWidthM;
    if (typeof data.defaultHeightM   === 'number') _defaultHeightM   = data.defaultHeightM;
    _notify();
  }

  return {
    subscribe,
    getDefaultBgColor,
    getDefaultFontColor,
    getDefaultFontSizeM,
    getDefaultWidthM,
    getDefaultHeightM,
    setDefaultBgColor,
    setDefaultFontColor,
    setDefaultFontSizeM,
    setDefaultWidthM,
    setDefaultHeightM,
    snapshot,
    restore,
  };
}
