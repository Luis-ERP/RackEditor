// ─────────────────────────────────────────────────────────────────────────────
//  Quote Store
//
//  Framework-agnostic store that manages a single quote lifecycle.
//  Provides quote CRUD, line-item management, discount handling,
//  CAD-BOM sync, and undo-friendly snapshot capabilities.
//
//  Follows the same subscribe/notify pattern as the CAD LayoutStore.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createQuote,
  withAddedQuoteLineItem,
  withRemovedQuoteLineItem,
  withUpdatedQuoteLineItemById,
  withSyncedCadBom,
  getCadReadOnlyLineItems,
  createQuoteLineItem,
  DISCOUNT_KIND,
} from './schemas/index.js';

const QUOTE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

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

  function getQuote() {
    return _quote;
  }

  function getLineItems() {
    return _quote.lineItems;
  }

  function getCadLineItems() {
    return getCadReadOnlyLineItems(_quote);
  }

  function getManualLineItems() {
    return _quote.lineItems.filter((li) => !li.isDesignLinked);
  }

  // ── Line Item Operations ────────────────────────────────────────

  function addLineItem(lineItemParams, updatedBy = null) {
    _setQuote(
      withAddedQuoteLineItem(_quote, lineItemParams, { updatedBy }),
    );
    return _quote;
  }

  function removeLineItem(lineItemId, updatedBy = null) {
    _setQuote(
      withRemovedQuoteLineItem(_quote, lineItemId, { updatedBy }),
    );
    return _quote;
  }

  function updateLineItem(lineItemId, updates, { allowCadOverrides = false, updatedBy = null } = {}) {
    _setQuote(
      withUpdatedQuoteLineItemById(_quote, lineItemId, updates, { allowCadOverrides, updatedBy }),
    );
    return _quote;
  }

  // ── Quote-Level Operations ──────────────────────────────────────

  function updateQuoteFields(fields) {
    const allowed = {};
    if (fields.quoteNumber !== undefined) allowed.quoteNumber = fields.quoteNumber;
    if (fields.status !== undefined) allowed.status = fields.status;
    if (fields.shipping !== undefined) allowed.shipping = fields.shipping;
    if (fields.freight !== undefined) allowed.freight = fields.freight;
    if (fields.taxRate !== undefined) allowed.taxRate = fields.taxRate;
    if (fields.discount !== undefined) allowed.discount = fields.discount;
    if (fields.clientRef !== undefined) allowed.clientRef = fields.clientRef;
    if (fields.extras !== undefined) allowed.extras = fields.extras;

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
      throw new Error(`Invalid status: ${status}`);
    }
    return updateQuoteFields({ status });
  }

  function setClientRef(clientRef) {
    return updateQuoteFields({ clientRef });
  }

  function setDiscount(discount) {
    return updateQuoteFields({ discount });
  }

  // ── CAD-BOM Sync ────────────────────────────────────────────────

  function syncFromBom(bomSnapshot, options = {}) {
    _setQuote(
      withSyncedCadBom(_quote, bomSnapshot, options),
    );
    return _quote;
  }

  // ── Undo ────────────────────────────────────────────────────────

  function undo() {
    if (_history.length === 0) return _quote;
    _quote = _history.pop();
    _notify();
    return _quote;
  }

  function canUndo() {
    return _history.length > 0;
  }

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

  // ── Snapshot ────────────────────────────────────────────────────

  function snapshot() {
    return JSON.parse(JSON.stringify(_quote));
  }

  // ── Public API ──────────────────────────────────────────────────

  return Object.freeze({
    subscribe,

    // Read
    getQuote,
    getLineItems,
    getCadLineItems,
    getManualLineItems,

    // Line items
    addLineItem,
    removeLineItem,
    updateLineItem,

    // Quote-level
    updateQuoteFields,
    setStatus,
    setClientRef,
    setDiscount,

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
  });
}

export { QUOTE_STATUS };
