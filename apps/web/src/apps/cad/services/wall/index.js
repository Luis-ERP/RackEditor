// ─────────────────────────────────────────────────────────────────────────────
//  Wall Service — Public API
//
//  Centralises wall-related exports.  The wall "domain" is intentionally
//  simpler than the rack domain — it owns the semantic properties (thickness,
//  material, etc.) while the layout system owns position/rendering.
// ─────────────────────────────────────────────────────────────────────────────

export { createWallStore } from './wallStore.js';
