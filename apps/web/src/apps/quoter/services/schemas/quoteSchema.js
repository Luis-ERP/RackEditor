// ─────────────────────────────────────────────────────────────────────────────
//  Quote Schema
//
//  Aggregate model for quote-level totals, line-item management, CAD-BOM
//  synchronization, versioning, and template support.
//
//  Schema aligns with quoter_requirements.md (non-relational style).
// ─────────────────────────────────────────────────────────────────────────────

import {
  ENTRY_TYPE,
  QUOTE_STATUS,
  computeEntriesTotal,
  createAuditFields,
  normalizeEntry,
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

function createVersionId() {
  return `ver-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Normalize the client object.
 *
 * @param {Object|null|undefined} client
 * @returns {Object}
 */
function normalizeClient(client) {
  if (!client) {
    return Object.freeze({
      organization_name: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
    });
  }
  return Object.freeze({
    organization_name: String(client.organization_name ?? client.name ?? ''),
    first_name: String(client.first_name ?? ''),
    last_name: String(client.last_name ?? ''),
    email: String(client.email ?? ''),
    phone: String(client.phone ?? ''),
  });
}

/**
 * Normalize an array of tax_rates entries.
 *
 * @param {Array} taxRates
 * @returns {ReadonlyArray}
 */
function normalizeTaxRates(taxRates) {
  if (!Array.isArray(taxRates)) return Object.freeze([]);
  return Object.freeze(
    taxRates.map((r) =>
      Object.freeze({
        id: r.id ?? `txr-${Math.random().toString(36).slice(2, 10)}`,
        name: String(r.name ?? ''),
        rate: Math.max(0, Number(r.rate ?? 0)),
      }),
    ),
  );
}

/**
 * Normalize an array of discounts or fees entries.
 *
 * @param {Array} entries
 * @returns {ReadonlyArray}
 */
function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return Object.freeze([]);
  return Object.freeze(entries.map(normalizeEntry));
}

/**
 * Create a quote aggregate.
 *
 * @param {Object} params
 * @param {string} [params.id]
 * @param {string} [params.order_number='']
 * @param {string} [params.status='draft']
 * @param {Object|null} [params.client]
 *   { organization_name, first_name, last_name, email, phone }
 * @param {Array} [params.line_items=[]]
 * @param {Array} [params.tax_rates=[]]  — [{ id, name, rate }]
 * @param {Array} [params.discounts=[]]  — [{ id, name, type, value }]
 * @param {Array} [params.fees=[]]       — [{ id, name, type, value }]
 * @param {number} [params.shipping=0]
 * @param {Object|null} [params.cad]     — { project_file }
 * @param {Object|null} [params.quote_template]
 *   { template_file, template_variables_mapping }
 * @param {Array} [params.versioning=[]] — [{ id, version, updated_at, updated_by, data }]
 * @param {Object|null} [params.audit=null]
 * @param {Record<string, unknown>} [params.extras]
 *
 * — Calculated fields (read-only):
 *   subtotal, total_discounts, total_fees, total_tax_rates, total
 */
export function createQuote({
  id = createQuoteId(),
  order_number = '',
  status = QUOTE_STATUS.DRAFT,
  client = null,
  line_items = [],
  tax_rates = [],
  discounts = [],
  fees = [],
  shipping = 0,
  cad = null,
  quote_template = null,
  versioning = [],
  audit = null,
  extras = {},

  // Legacy aliases for backwards compat during migration
  quoteNumber,
  clientRef,
  lineItems,
  taxRate,
  discount,
  freight,
  linkedDesign,
}) {
  // Merge legacy aliases
  const resolvedOrderNumber = order_number || quoteNumber || '';
  const resolvedClient = client ?? (clientRef ? { organization_name: clientRef.name ?? '' } : null);
  const resolvedLineItems = line_items.length > 0 ? line_items : (lineItems ?? []);
  const resolvedShipping = Number(shipping ?? 0) + Number(freight ?? 0);

  // tax_rates: legacy single taxRate → array
  let resolvedTaxRates = tax_rates;
  if (resolvedTaxRates.length === 0 && taxRate != null) {
    resolvedTaxRates = [{ id: 'txr-default', name: 'Tax', rate: Number(taxRate) }];
  }

  // discounts: legacy single discount object → array
  let resolvedDiscounts = discounts;
  if (resolvedDiscounts.length === 0 && discount && discount.kind && discount.kind !== 'NONE' && discount.value > 0) {
    const type = discount.kind === 'PERCENTAGE' ? ENTRY_TYPE.PERCENTAGE : ENTRY_TYPE.FIXED;
    resolvedDiscounts = [{ id: 'dis-legacy', name: 'Discount', type, value: discount.value }];
  }

  // cad: legacy linkedDesign → cad
  const resolvedCad = cad ?? (linkedDesign ? { project_file: linkedDesign.designId ?? '' } : null);

  const normalizedLineItems = resolvedLineItems.map((li) => createQuoteLineItem(li));

  if (!Number.isFinite(resolvedShipping) || resolvedShipping < 0) {
    throw new RangeError('Quote shipping must be a finite non-negative number.');
  }

  const normalizedClient = normalizeClient(resolvedClient);
  const normalizedTaxRates = normalizeTaxRates(resolvedTaxRates);
  const normalizedDiscounts = normalizeEntries(resolvedDiscounts);
  const normalizedFees = normalizeEntries(fees);

  // ── Calculated totals ────────────────────────────────────────────────────
  const subtotal = roundCurrency(
    normalizedLineItems.reduce((sum, li) => sum + Number(li.total ?? 0), 0),
  );

  // Discounts and fees apply to subtotal as base
  const total_discounts = computeEntriesTotal(subtotal, normalizedDiscounts);
  const total_fees = computeEntriesTotal(subtotal, normalizedFees);

  // total_tax_rates = sum of all rates (e.g. 0.16 + 0.01 = 0.17)
  const total_tax_rates = roundCurrency(
    normalizedTaxRates.reduce((sum, r) => sum + Number(r.rate ?? 0), 0),
  );

  // taxable_base = (subtotal - discounts + shipping + fees)
  const taxable_base = roundCurrency(
    Math.max(0, subtotal - total_discounts + resolvedShipping + total_fees),
  );
  const tax_amount = roundCurrency(taxable_base * total_tax_rates);
  const total = roundCurrency(taxable_base + tax_amount);

  const normalizedCad = resolvedCad
    ? Object.freeze({ project_file: String(resolvedCad.project_file ?? '') })
    : null;

  const normalizedTemplate = quote_template
    ? Object.freeze({
        template_file: String(quote_template.template_file ?? ''),
        template_variables_mapping: Object.freeze({ ...(quote_template.template_variables_mapping ?? {}) }),
      })
    : null;

  const normalizedVersioning = Array.isArray(versioning)
    ? Object.freeze(versioning.map((v) => Object.freeze({ ...v })))
    : Object.freeze([]);

  return Object.freeze({
    id,
    order_number: resolvedOrderNumber,
    status,
    client: normalizedClient,
    line_items: Object.freeze(normalizedLineItems),
    tax_rates: normalizedTaxRates,
    discounts: normalizedDiscounts,
    fees: normalizedFees,
    shipping: roundCurrency(resolvedShipping),
    cad: normalizedCad,
    quote_template: normalizedTemplate,
    versioning: normalizedVersioning,

    // Calculated (read-only)
    subtotal,
    total_discounts,
    total_fees,
    total_tax_rates,
    tax_amount,
    total,

    audit: createAuditFields(audit ?? {}),
    extras: normalizeExtras(extras),
  });
}

// ── Line Item Mutations ──────────────────────────────────────────────────────

/**
 * @param {ReturnType<typeof createQuote>} quote
 * @param {Object} lineItem
 * @param {Object} [options]
 * @param {string|null} [options.updatedBy=null]
 */
export function withAddedQuoteLineItem(quote, lineItem, { updatedBy = null } = {}) {
  const candidate = createQuoteLineItem(lineItem);
  return createQuote({
    ...quote,
    line_items: [...quote.line_items, candidate],
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

/**
 * @param {ReturnType<typeof createQuote>} quote
 * @param {string} lineItemId
 * @param {Object} [options]
 * @param {string|null} [options.updatedBy=null]
 */
export function withRemovedQuoteLineItem(quote, lineItemId, { updatedBy = null } = {}) {
  const target = quote.line_items.find((li) => li.id === lineItemId);
  if (!target) return quote;
  if (!canRemoveQuoteLineItem(target)) {
    throw new Error('Cannot remove line item.');
  }
  return createQuote({
    ...quote,
    line_items: quote.line_items.filter((li) => li.id !== lineItemId),
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
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
  const updatedLineItems = quote.line_items.map((li) => {
    if (li.id !== lineItemId) return li;
    return withUpdatedQuoteLineItem(li, updates, { allowCadOverrides, updatedBy });
  });
  return createQuote({
    ...quote,
    line_items: updatedLineItems,
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

// ── Tax Rates Mutations ──────────────────────────────────────────────────────

export function withAddedTaxRate(quote, taxRate, { updatedBy = null } = {}) {
  const entry = Object.freeze({
    id: taxRate.id ?? `txr-${Math.random().toString(36).slice(2, 10)}`,
    name: String(taxRate.name ?? ''),
    rate: Math.max(0, Number(taxRate.rate ?? 0)),
  });
  return createQuote({
    ...quote,
    tax_rates: [...quote.tax_rates, entry],
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

export function withRemovedTaxRate(quote, taxRateId, { updatedBy = null } = {}) {
  return createQuote({
    ...quote,
    tax_rates: quote.tax_rates.filter((r) => r.id !== taxRateId),
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

export function withUpdatedTaxRate(quote, taxRateId, updates, { updatedBy = null } = {}) {
  const updated = quote.tax_rates.map((r) =>
    r.id === taxRateId
      ? Object.freeze({ ...r, ...updates, id: r.id })
      : r,
  );
  return createQuote({
    ...quote,
    tax_rates: updated,
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

// ── Discounts Array Mutations ────────────────────────────────────────────────

export function withAddedDiscount(quote, discount, { updatedBy = null } = {}) {
  return createQuote({
    ...quote,
    discounts: [...quote.discounts, normalizeEntry(discount)],
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

export function withRemovedDiscount(quote, discountId, { updatedBy = null } = {}) {
  return createQuote({
    ...quote,
    discounts: quote.discounts.filter((d) => d.id !== discountId),
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

export function withUpdatedDiscount(quote, discountId, updates, { updatedBy = null } = {}) {
  const updated = quote.discounts.map((d) =>
    d.id === discountId ? normalizeEntry({ ...d, ...updates, id: d.id }) : d,
  );
  return createQuote({
    ...quote,
    discounts: updated,
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

// ── Fees Array Mutations ─────────────────────────────────────────────────────

export function withAddedFee(quote, fee, { updatedBy = null } = {}) {
  return createQuote({
    ...quote,
    fees: [...quote.fees, normalizeEntry(fee)],
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

export function withRemovedFee(quote, feeId, { updatedBy = null } = {}) {
  return createQuote({
    ...quote,
    fees: quote.fees.filter((f) => f.id !== feeId),
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

export function withUpdatedFee(quote, feeId, updates, { updatedBy = null } = {}) {
  const updated = quote.fees.map((f) =>
    f.id === feeId ? normalizeEntry({ ...f, ...updates, id: f.id }) : f,
  );
  return createQuote({
    ...quote,
    fees: updated,
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

// ── Versioning ───────────────────────────────────────────────────────────────

/**
 * Snapshot current quote data as a new version entry and append to versioning.
 *
 * @param {ReturnType<typeof createQuote>} quote
 * @param {Object} [options]
 * @param {string|null} [options.updatedBy=null]
 */
export function withSavedVersion(quote, { updatedBy = null } = {}) {
  const nextVersionNumber = (quote.versioning.length > 0
    ? Math.max(...quote.versioning.map((v) => v.version))
    : 0) + 1;

  // Snapshot everything except versioning itself
  const { versioning: _v, ...quoteData } = quote;
  const versionEntry = Object.freeze({
    id: createVersionId(),
    version: nextVersionNumber,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
    data: JSON.parse(JSON.stringify(quoteData)),
  });

  return createQuote({
    ...quote,
    versioning: [...quote.versioning, versionEntry],
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

/**
 * Restore quote to a historical version's data, keeping the versioning array intact.
 *
 * @param {ReturnType<typeof createQuote>} quote
 * @param {string} versionId
 * @param {Object} [options]
 * @param {string|null} [options.updatedBy=null]
 */
export function withRestoredVersion(quote, versionId, { updatedBy = null } = {}) {
  const versionEntry = quote.versioning.find((v) => v.id === versionId);
  if (!versionEntry) throw new Error(`Version ${versionId} not found.`);

  return createQuote({
    ...versionEntry.data,
    versioning: quote.versioning,
    audit: {
      ...(versionEntry.data.audit ?? {}),
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
  });
}

// ── CAD-BOM Sync ─────────────────────────────────────────────────────────────

/**
 * Sync CAD-linked lines from a BOM snapshot while preserving manual lines.
 *
 * @param {ReturnType<typeof createQuote>} quote
 * @param {{ items: Array, generatedAt?: string, catalogVersion?: string }} bomSnapshot
 * @param {Object} [options]
 * @param {(sku: string, bomLine: Object) => { cost: number, weight_kg?: number }} [options.resolveCatalog]
 * @param {(sku: string, bomLine: Object) => number} [options.resolveCost]  — legacy
 * @param {string|null} [options.projectFile=null]
 * @param {string|null} [options.updatedBy=null]
 */
export function withSyncedCadBom(
  quote,
  bomSnapshot,
  {
    resolveCatalog,
    resolveCost,
    projectFile = null,
    // legacy params
    designId,
    designRevisionId,
    updatedBy = null,
  } = {},
) {
  const manualLineItems = quote.line_items.filter((li) => !li.isDesignLinked);

  const cadLineItems = (bomSnapshot?.items ?? []).map((bomLine, index) => {
    return createQuoteLineItemFromBomLine(bomLine, index, {
      resolveCatalog,
      resolveCost,
      designId: projectFile ?? designId,
      designRevisionId,
      catalogVersion: bomSnapshot?.catalogVersion,
      audit: { createdBy: updatedBy, updatedBy },
      extras: { bomGeneratedAt: bomSnapshot?.generatedAt ?? null, ...(bomLine._dims ?? {}) },
    });
  });

  return createQuote({
    ...quote,
    cad: { project_file: projectFile ?? quote.cad?.project_file ?? '' },
    line_items: [...cadLineItems, ...manualLineItems],
    audit: { ...quote.audit, updatedAt: new Date().toISOString(), updatedBy },
  });
}

// ── Read projections ─────────────────────────────────────────────────────────

export function getCadReadOnlyLineItems(quote) {
  return quote.line_items.filter((li) => li.isDesignLinked);
}
