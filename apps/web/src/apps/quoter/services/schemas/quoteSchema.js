// ─────────────────────────────────────────────────────────────────────────────
//  Quote Schema
//
//  Aggregate model for quote-level totals, line-item management, and CAD-BOM
//  synchronization while preserving manual lines.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DEFAULT_TAX_RATE,
  DISCOUNT_KIND,
  computeDiscountAmount,
  createAuditFields,
  normalizeDiscount,
  normalizeExtras,
  roundCurrency,
} from './common.js';

import {
  canRemoveQuoteLineItem,
  createQuoteLineItem,
  createQuoteLineItemFromBomLine,
  withUpdatedQuoteLineItem,
} from './quoteLineItemSchema.js';

function createQuoteId(prefix = 'qte') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {Object} params
 * @param {string} [params.id]
 * @param {string} [params.quoteNumber='']
 * @param {string} [params.status='DRAFT']
 * @param {Object|null} [params.clientRef=null]
 * @param {Object|null} [params.linkedDesign=null]
 * @param {Array} [params.lineItems=[]]
 * @param {number} [params.shipping=0]
 * @param {number} [params.freight=0]
 * @param {{ kind?: string, value?: number }} [params.discount]
 * @param {number} [params.taxRate=0.16]
 * @param {Object|null} [params.audit=null]
 * @param {Record<string, unknown>} [params.extras]
 */
export function createQuote({
  id = createQuoteId(),
  quoteNumber = '',
  status = 'DRAFT',
  clientRef = null,
  linkedDesign = null,
  lineItems = [],
  shipping = 0,
  freight = 0,
  discount = { kind: DISCOUNT_KIND.NONE, value: 0 },
  taxRate = DEFAULT_TAX_RATE,
  audit = null,
  extras = {},
}) {
  const normalizedLineItems = lineItems.map((lineItem) => createQuoteLineItem(lineItem));
  const safeShipping = Number(shipping);
  const safeFreight = Number(freight);
  const safeTaxRate = Number(taxRate);

  if (!Number.isFinite(safeShipping) || safeShipping < 0) {
    throw new RangeError('Quote shipping must be a finite non-negative number.');
  }

  if (!Number.isFinite(safeFreight) || safeFreight < 0) {
    throw new RangeError('Quote freight must be a finite non-negative number.');
  }

  if (!Number.isFinite(safeTaxRate) || safeTaxRate < 0) {
    throw new RangeError('Quote taxRate must be a finite non-negative number.');
  }

  const normalizedDiscount = normalizeDiscount(discount);

  const subtotal = roundCurrency(
    normalizedLineItems.reduce((sum, lineItem) => sum + Number(lineItem.total ?? 0), 0),
  );

  const preTaxBase = roundCurrency(subtotal + safeShipping + safeFreight);
  const discountAmount = computeDiscountAmount(preTaxBase, normalizedDiscount);
  const taxableBase = roundCurrency(Math.max(0, preTaxBase - discountAmount));
  const taxAmount = roundCurrency(taxableBase * safeTaxRate);
  const total = roundCurrency(taxableBase + taxAmount);

  return Object.freeze({
    id,
    quoteNumber,
    status,
    clientRef: clientRef ? Object.freeze({ ...clientRef }) : null,
    linkedDesign: linkedDesign ? Object.freeze({ ...linkedDesign }) : null,
    lineItems: Object.freeze(normalizedLineItems),
    subtotal,
    shipping: roundCurrency(safeShipping),
    freight: roundCurrency(safeFreight),
    discount: normalizedDiscount,
    discountAmount,
    taxRate: safeTaxRate,
    taxAmount,
    total,
    audit: createAuditFields(audit ?? {}),
    extras: normalizeExtras(extras),
  });
}

/**
 * @param {ReturnType<typeof createQuote>} quote
 * @param {ReturnType<typeof createQuoteLineItem>|Object} lineItem
 * @param {Object} [options]
 * @param {string|null} [options.updatedBy=null]
 */
export function withAddedQuoteLineItem(quote, lineItem, { updatedBy = null } = {}) {
  const candidate = createQuoteLineItem(lineItem);
  return createQuote({
    ...quote,
    lineItems: [...quote.lineItems, candidate],
    audit: {
      ...quote.audit,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
  });
}

/**
 * @param {ReturnType<typeof createQuote>} quote
 * @param {string} lineItemId
 * @param {Object} [options]
 * @param {string|null} [options.updatedBy=null]
 */
export function withRemovedQuoteLineItem(quote, lineItemId, { updatedBy = null } = {}) {
  const target = quote.lineItems.find((lineItem) => lineItem.id === lineItemId);
  if (!target) {
    return quote;
  }

  if (!canRemoveQuoteLineItem(target)) {
    throw new Error('Cannot remove CAD-generated line item.');
  }

  return createQuote({
    ...quote,
    lineItems: quote.lineItems.filter((lineItem) => lineItem.id !== lineItemId),
    audit: {
      ...quote.audit,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
  });
}

/**
 * @param {ReturnType<typeof createQuote>} quote
 * @param {string} lineItemId
 * @param {Object} updates
 * @param {Object} [options]
 * @param {boolean} [options.allowCadOverrides=false]
 * @param {string|null} [options.updatedBy=null]
 */
export function withUpdatedQuoteLineItemById(
  quote,
  lineItemId,
  updates,
  { allowCadOverrides = false, updatedBy = null } = {},
) {
  const updatedLineItems = quote.lineItems.map((lineItem) => {
    if (lineItem.id !== lineItemId) {
      return lineItem;
    }
    return withUpdatedQuoteLineItem(lineItem, updates, { allowCadOverrides, updatedBy });
  });

  return createQuote({
    ...quote,
    lineItems: updatedLineItems,
    audit: {
      ...quote.audit,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
  });
}

/**
 * Sync CAD-linked lines from a BOM snapshot while preserving all manual lines.
 *
 * @param {ReturnType<typeof createQuote>} quote
 * @param {{ items: Array, generatedAt?: string, catalogVersion?: string }} bomSnapshot
 * @param {Object} [options]
 * @param {(sku: string, bomLine: Object) => number} [options.resolveCost]
 * @param {string|null} [options.designId=null]
 * @param {string|null} [options.designRevisionId=null]
 * @param {string|null} [options.updatedBy=null]
 */
export function withSyncedCadBom(
  quote,
  bomSnapshot,
  {
    resolveCost,
    designId = null,
    designRevisionId = null,
    updatedBy = null,
  } = {},
) {
  const manualLineItems = quote.lineItems.filter((lineItem) => !lineItem.isDesignLinked);

  const cadLineItems = (bomSnapshot?.items ?? []).map((bomLine, index) => {
    return createQuoteLineItemFromBomLine(bomLine, index, {
      resolveCost,
      designId,
      designRevisionId,
      catalogVersion: bomSnapshot?.catalogVersion,
      audit: {
        createdBy: updatedBy,
        updatedBy,
      },
      extras: {
        bomGeneratedAt: bomSnapshot?.generatedAt ?? null,
      },
    });
  });

  return createQuote({
    ...quote,
    linkedDesign: {
      ...(quote.linkedDesign ?? {}),
      designId,
      designRevisionId,
      bomGeneratedAt: bomSnapshot?.generatedAt ?? null,
      catalogVersion: bomSnapshot?.catalogVersion ?? null,
    },
    lineItems: [...cadLineItems, ...manualLineItems],
    audit: {
      ...quote.audit,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
  });
}

/**
 * Read-only projection of CAD-generated lines.
 *
 * @param {ReturnType<typeof createQuote>} quote
 * @returns {Array}
 */
export function getCadReadOnlyLineItems(quote) {
  return quote.lineItems.filter((lineItem) => lineItem.isDesignLinked);
}
