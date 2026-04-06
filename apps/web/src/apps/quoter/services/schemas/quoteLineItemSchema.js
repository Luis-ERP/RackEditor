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
 * @param {number} [params.marginRate=0.2]  — margin 0-1 (e.g. 0.2 = 20%)
 * @param {number} [params.quantity=1]
 * @param {{ kind?: string, value?: number }} [params.discount]
 * @param {string} [params.source='MANUAL']
 * @param {boolean} [params.isReadOnlyFromCad=false]
 * @param {boolean} [params.isDesignLinked=false]
 * @param {{ name: string, sku: string, weight_kg: number }|null} [params.variant]
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
  variant = null,
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
  // price = cost * (1 + margin)
  const price = roundCurrency(safeCost * (1 + safeMarginRate));
  // subtotal = price * quantity
  const lineBaseTotal = roundCurrency(price * safeQuantity);
  const discountAmount = computeDiscountAmount(lineBaseTotal, normalizedDiscount);
  // total = subtotal - discount
  const total = roundCurrency(Math.max(0, lineBaseTotal - discountAmount));

  const normalizedVariant = variant
    ? Object.freeze({
        name: String(variant.name ?? ''),
        sku: String(variant.sku ?? ''),
        weight_kg: Number(variant.weight_kg ?? 0),
      })
    : null;

  return Object.freeze({
    id,
    name,
    description,
    source,
    variant: normalizedVariant,
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
 * @param {(sku: string, bomLine: Object) => { cost: number, weight_kg?: number }} [options.resolveCatalog]
 * @param {(sku: string, bomLine: Object) => number} [options.resolveCost]  — legacy, use resolveCatalog
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
    resolveCatalog,
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

  // Resolve cost and variant data from catalog
  let resolvedCost = 0;
  let resolvedWeight = 0;
  if (typeof resolveCatalog === 'function') {
    const catalogEntry = resolveCatalog(sku, bomLine);
    if (catalogEntry) {
      resolvedCost = Number(catalogEntry.cost ?? catalogEntry.price ?? 0);
      resolvedWeight = Number(catalogEntry.weight_kg ?? 0);
    }
  } else if (typeof resolveCost === 'function') {
    resolvedCost = Number(resolveCost(sku, bomLine));
  }

  const safeCost = Number.isFinite(resolvedCost) && resolvedCost >= 0 ? resolvedCost : 0;
  const safeWeight = Number.isFinite(resolvedWeight) && resolvedWeight >= 0 ? resolvedWeight : 0;

  const lineItemName = String(bomLine.name ?? sku);
  const lineItemDescription = String(bomLine.description ?? lineItemName);

  return createQuoteLineItem({
    name: lineItemName,
    description: lineItemDescription,
    cost: safeCost,
    quantity,
    source: QUOTE_LINE_SOURCE.CAD_BOM,
    isReadOnlyFromCad: true,
    isDesignLinked: true,
    variant: {
      name: lineItemName,
      sku,
      weight_kg: safeWeight,
    },
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
  return Boolean(lineItem && lineItem.id);
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
    variant: updates.variant !== undefined ? updates.variant : lineItem.variant,
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
