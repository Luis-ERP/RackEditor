// ─────────────────────────────────────────────────────────────────────────────
//  Quote Store
//
//  Framework-agnostic store that manages a single quote lifecycle.
//  Provides quote CRUD, line-item management, tax/discount/fee array management,
//  versioning, CAD-BOM sync, and undo-friendly snapshot capabilities.
//
//  Follows the same subscribe/notify pattern as the CAD LayoutStore.
// ─────────────────────────────────────────────────────────────────────────────

import {
  QUOTE_STATUS,
  ENTRY_TYPE,
  createQuote,
  withAddedQuoteLineItem,
  withRemovedQuoteLineItem,
  withUpdatedQuoteLineItemById,
  withAddedTaxRate,
  withRemovedTaxRate,
  withUpdatedTaxRate,
  withAddedDiscount,
  withRemovedDiscount,
  withUpdatedDiscount,
  withAddedFee,
  withRemovedFee,
  withUpdatedFee,
  withSavedVersion,
  withRestoredVersion,
  withSyncedCadBom,
  getCadReadOnlyLineItems,
} from './schemas/index.js';

export { QUOTE_STATUS, ENTRY_TYPE };

/**
 * Create a new QuoteStore instance.
 *
 * @param {Object} [initialQuoteParams] — optional params passed to createQuote
 * @returns {QuoteStore}
 */
export function createQuoteStore(initialQuoteParams) {
  /** @type {ReturnType<typeof createQuote>} */
  let _quote = createQuote(initialQuoteParams ?? {});

  /** @type {Array<ReturnType<typeof createQuote>>} */
  const _history = [];
  const MAX_HISTORY = 50;

  /** @type {Function[]} */
  const _listeners = [];

  // ── Internal helpers ────────────────────────────────────────────

  function _notify() {
    for (const fn of _listeners) fn();
  }

  function _pushHistory() {
    _history.push(_quote);
    if (_history.length > MAX_HISTORY) _history.shift();
  }

  function _setQuote(next) {
    _pushHistory();
    _quote = next;
    _notify();
  }

  // ── Subscription ────────────────────────────────────────────────

  /** @param {Function} listener @returns {Function} unsubscribe */
  function subscribe(listener) {
    _listeners.push(listener);
    return () => {
      const idx = _listeners.indexOf(listener);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }

  // ── Read ────────────────────────────────────────────────────────

  function getQuote() { return _quote; }

  function getLineItems() { return _quote.line_items; }

  function getCadLineItems() { return getCadReadOnlyLineItems(_quote); }

  function getManualLineItems() { return _quote.line_items.filter((li) => !li.isDesignLinked); }

  function getVersions() { return _quote.versioning; }

  // ── Line Item Operations ────────────────────────────────────────

  function addLineItem(lineItemParams, updatedBy = null) {
    _setQuote(withAddedQuoteLineItem(_quote, lineItemParams, { updatedBy }));
    return _quote;
  }

  function removeLineItem(lineItemId, updatedBy = null) {
    _setQuote(withRemovedQuoteLineItem(_quote, lineItemId, { updatedBy }));
    return _quote;
  }

  function updateLineItem(lineItemId, updates, { allowCadOverrides = false, updatedBy = null } = {}) {
    _setQuote(withUpdatedQuoteLineItemById(_quote, lineItemId, updates, { allowCadOverrides, updatedBy }));
    return _quote;
  }

  // ── Tax Rates Array ─────────────────────────────────────────────

  function addTaxRate(taxRate, updatedBy = null) {
    _setQuote(withAddedTaxRate(_quote, taxRate, { updatedBy }));
    return _quote;
  }

  function removeTaxRate(taxRateId, updatedBy = null) {
    _setQuote(withRemovedTaxRate(_quote, taxRateId, { updatedBy }));
    return _quote;
  }

  function updateTaxRate(taxRateId, updates, updatedBy = null) {
    _setQuote(withUpdatedTaxRate(_quote, taxRateId, updates, { updatedBy }));
    return _quote;
  }

  // ── Discounts Array ─────────────────────────────────────────────

  function addDiscount(discount, updatedBy = null) {
    _setQuote(withAddedDiscount(_quote, discount, { updatedBy }));
    return _quote;
  }

  function removeDiscount(discountId, updatedBy = null) {
    _setQuote(withRemovedDiscount(_quote, discountId, { updatedBy }));
    return _quote;
  }

  function updateDiscount(discountId, updates, updatedBy = null) {
    _setQuote(withUpdatedDiscount(_quote, discountId, updates, { updatedBy }));
    return _quote;
  }

  // ── Fees Array ──────────────────────────────────────────────────

  function addFee(fee, updatedBy = null) {
    _setQuote(withAddedFee(_quote, fee, { updatedBy }));
    return _quote;
  }

  function removeFee(feeId, updatedBy = null) {
    _setQuote(withRemovedFee(_quote, feeId, { updatedBy }));
    return _quote;
  }

  function updateFee(feeId, updates, updatedBy = null) {
    _setQuote(withUpdatedFee(_quote, feeId, updates, { updatedBy }));
    return _quote;
  }

  // ── Quote-Level Fields ──────────────────────────────────────────

  function updateQuoteFields(fields) {
    const allowed = {};
    if (fields.order_number !== undefined) allowed.order_number = fields.order_number;
    if (fields.status !== undefined) allowed.status = fields.status;
    if (fields.shipping !== undefined) allowed.shipping = fields.shipping;
    if (fields.client !== undefined) allowed.client = fields.client;
    if (fields.cad !== undefined) allowed.cad = fields.cad;
    if (fields.quote_template !== undefined) allowed.quote_template = fields.quote_template;
    // Legacy compat
    if (fields.quoteNumber !== undefined) allowed.order_number = fields.quoteNumber;

    _setQuote(createQuote({
      ..._quote,
      ...allowed,
      audit: {
        ..._quote.audit,
        updatedAt: new Date().toISOString(),
        updatedBy: fields.updatedBy ?? _quote.audit.updatedBy,
      },
    }));
    return _quote;
  }

  function setStatus(status) {
    if (!Object.values(QUOTE_STATUS).includes(status)) {
      throw new Error(`Invalid status: ${status}. Valid: ${Object.values(QUOTE_STATUS).join(', ')}`);
    }
    return updateQuoteFields({ status });
  }

  // ── Versioning ──────────────────────────────────────────────────

  function saveVersion(updatedBy = null) {
    _setQuote(withSavedVersion(_quote, { updatedBy }));
    return _quote;
  }

  function switchToVersion(versionId, updatedBy = null) {
    _setQuote(withRestoredVersion(_quote, versionId, { updatedBy }));
    return _quote;
  }

  // ── CAD-BOM Sync ────────────────────────────────────────────────

  function syncFromBom(bomSnapshot, options = {}) {
    _setQuote(withSyncedCadBom(_quote, bomSnapshot, options));
    return _quote;
  }

  // ── Undo ────────────────────────────────────────────────────────

  function undo() {
    if (_history.length === 0) return _quote;
    _quote = _history.pop();
    _notify();
    return _quote;
  }

  function canUndo() { return _history.length > 0; }

  // ── Reset / Load ────────────────────────────────────────────────

  function resetQuote(params) {
    _history.length = 0;
    _quote = createQuote(params ?? {});
    _notify();
    return _quote;
  }

  function loadQuote(quoteData) {
    _history.length = 0;
    _quote = createQuote(quoteData);
    _notify();
    return _quote;
  }

  function snapshot() { return JSON.parse(JSON.stringify(_quote)); }

  // ── Public API ──────────────────────────────────────────────────

  return Object.freeze({
    subscribe,

    // Read
    getQuote,
    getLineItems,
    getCadLineItems,
    getManualLineItems,
    getVersions,

    // Line items
    addLineItem,
    removeLineItem,
    updateLineItem,

    // Tax rates
    addTaxRate,
    removeTaxRate,
    updateTaxRate,

    // Discounts
    addDiscount,
    removeDiscount,
    updateDiscount,

    // Fees
    addFee,
    removeFee,
    updateFee,

    // Quote-level
    updateQuoteFields,
    setStatus,

    // Versioning
    saveVersion,
    switchToVersion,
    getVersions,

    // BOM sync
    syncFromBom,

    // Undo
    undo,
    canUndo,

    // Lifecycle
    resetQuote,
    loadQuote,
    snapshot,

    // Constants
    QUOTE_STATUS,
    ENTRY_TYPE,
  });
}
