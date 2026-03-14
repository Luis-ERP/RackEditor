// ─────────────────────────────────────────────────────────────────────────────
//  Quote Line Item Schema
//
//  Handles line-item pricing, discounts, CAD-BOM traceability, and immutable
//  update helpers.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DEFAULT_MARGIN_RATE,
  DISCOUNT_KIND,
  QUOTE_LINE_SOURCE,
  computeDiscountAmount,
  createAuditFields,
  normalizeDiscount,
  normalizeExtras,
  roundCurrency,
} from './common.js';

function createLineItemId(prefix = 'qli') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {Object} params
 * @param {string} [params.id]
 * @param {string} params.name
 * @param {string} [params.description='']
 * @param {number} params.cost
 * @param {number} [params.marginRate=0.2]
 * @param {number} [params.quantity=1]
 * @param {{ kind?: string, value?: number }} [params.discount]
 * @param {string} [params.source='MANUAL']
 * @param {boolean} [params.isReadOnlyFromCad=false]
 * @param {boolean} [params.isDesignLinked=false]
 * @param {Object|null} [params.traceability=null]
 * @param {Object|null} [params.catalogRef=null]
 * @param {Object|null} [params.audit=null]
 * @param {Record<string, unknown>} [params.extras]
 */
export function createQuoteLineItem({
  id = createLineItemId(),
  name,
  description = '',
  cost,
  marginRate = DEFAULT_MARGIN_RATE,
  quantity = 1,
  discount = { kind: DISCOUNT_KIND.NONE, value: 0 },
  source = QUOTE_LINE_SOURCE.MANUAL,
  isReadOnlyFromCad = false,
  isDesignLinked = false,
  traceability = null,
  catalogRef = null,
  audit = null,
  extras = {},
}) {
  if (!name || typeof name !== 'string') {
    throw new Error('Quote line item name is required.');
  }

  if (!Object.values(QUOTE_LINE_SOURCE).includes(source)) {
    throw new Error(`Unsupported quote line item source: ${source}`);
  }

  const safeCost = Number(cost);
  if (!Number.isFinite(safeCost) || safeCost < 0) {
    throw new RangeError('Line item cost must be a finite non-negative number.');
  }

  const safeMarginRate = Number(marginRate);
  if (!Number.isFinite(safeMarginRate) || safeMarginRate < 0) {
    throw new RangeError('Line item marginRate must be a finite non-negative number.');
  }

  const safeQuantity = Number(quantity);
  if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
    throw new RangeError('Line item quantity must be a finite positive number.');
  }

  const normalizedDiscount = normalizeDiscount(discount);
  const price = roundCurrency(safeCost + safeCost * safeMarginRate);
  const lineBaseTotal = roundCurrency(price * safeQuantity);
  const discountAmount = computeDiscountAmount(lineBaseTotal, normalizedDiscount);
  const total = roundCurrency(Math.max(0, lineBaseTotal - discountAmount));

  return Object.freeze({
    id,
    name,
    description,
    source,
    traceability: traceability ? Object.freeze({ ...traceability }) : null,
    catalogRef: catalogRef ? Object.freeze({ ...catalogRef }) : null,
    cost: roundCurrency(safeCost),
    marginRate: safeMarginRate,
    price,
    quantity: safeQuantity,
    discount: normalizedDiscount,
    discountAmount,
    total,
    isReadOnlyFromCad: Boolean(isReadOnlyFromCad),
    isDesignLinked: Boolean(isDesignLinked),
    audit: createAuditFields(audit ?? {}),
    extras: normalizeExtras(extras),
  });
}

/**
 * @param {Object} bomLine
 * @param {number} bomLineIndex
 * @param {Object} options
 * @param {(sku: string, bomLine: Object) => number} [options.resolveCost]
 * @param {string} [options.designId]
 * @param {string} [options.designRevisionId]
 * @param {string} [options.catalogVersion]
 * @param {Object|null} [options.audit]
 * @param {Record<string, unknown>} [options.extras]
 */
export function createQuoteLineItemFromBomLine(
  bomLine,
  bomLineIndex,
  {
    resolveCost,
    designId,
    designRevisionId,
    catalogVersion,
    audit = null,
    extras = {},
  } = {},
) {
  if (!bomLine || typeof bomLine !== 'object') {
    throw new Error('bomLine must be a valid object.');
  }

  const sku = String(bomLine.sku ?? '').trim();
  if (!sku) {
    throw new Error('bomLine.sku is required for traceability.');
  }

  const quantity = Number(bomLine.quantity ?? 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new RangeError('bomLine.quantity must be a finite positive number.');
  }

  const resolvedCost = typeof resolveCost === 'function'
    ? Number(resolveCost(sku, bomLine))
    : 0;

  const safeCost = Number.isFinite(resolvedCost) && resolvedCost >= 0 ? resolvedCost : 0;

  const lineItemName = String(bomLine.name ?? sku);
  const lineItemDescription = String(
    bomLine.description ?? `${lineItemName} | SKU ${sku} | Unit ${bomLine.unit ?? 'ea'}`,
  );

  return createQuoteLineItem({
    name: lineItemName,
    description: lineItemDescription,
    cost: safeCost,
    quantity,
    source: QUOTE_LINE_SOURCE.CAD_BOM,
    isReadOnlyFromCad: true,
    isDesignLinked: true,
    traceability: {
      bomLineIndex,
      sku,
      rule: bomLine.rule ?? null,
      designId: designId ?? null,
      designRevisionId: designRevisionId ?? null,
    },
    catalogRef: {
      sku,
      catalogVersion: catalogVersion ?? null,
      source: 'core/rack/catalog_lists',
    },
    audit,
    extras,
  });
}

/**
 * @param {ReturnType<typeof createQuoteLineItem>} lineItem
 * @returns {boolean}
 */
export function canRemoveQuoteLineItem(lineItem) {
  return !lineItem.isDesignLinked;
}

/**
 * @param {ReturnType<typeof createQuoteLineItem>} lineItem
 * @param {Object} updates
 * @param {Object} [options]
 * @param {boolean} [options.allowCadOverrides=false]
 * @param {string|null} [options.updatedBy=null]
 */
export function withUpdatedQuoteLineItem(
  lineItem,
  updates,
  { allowCadOverrides = false, updatedBy = null } = {},
) {
  if (!allowCadOverrides && lineItem.isReadOnlyFromCad) {
    throw new Error('CAD linked line items are read-only and cannot be edited.');
  }

  const next = {
    ...lineItem,
    ...updates,
    id: lineItem.id,
    source: lineItem.source,
    traceability: lineItem.traceability,
    isReadOnlyFromCad: lineItem.isReadOnlyFromCad,
    isDesignLinked: lineItem.isDesignLinked,
    audit: {
      ...lineItem.audit,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
  };

  return createQuoteLineItem(next);
}
