// ─────────────────────────────────────────────────────────────────────────────
//  Quoter Shared Schema Primitives
//
//  Provides reusable enum-like constants and helper utilities shared by
//  quoter domain models.
// ─────────────────────────────────────────────────────────────────────────────

export const DISCOUNT_KIND = Object.freeze({
  NONE: 'NONE',
  PERCENTAGE: 'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
});

export const QUOTE_LINE_SOURCE = Object.freeze({
  CAD_BOM: 'CAD_BOM',
  MANUAL: 'MANUAL',
});

/** Quote lifecycle states (matches requirements: draft, sent, rejected, closed) */
export const QUOTE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  REJECTED: 'rejected',
  CLOSED: 'closed',
});

/** Type options for discounts and fees arrays */
export const ENTRY_TYPE = Object.freeze({
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
});

export const DEFAULT_MARGIN_RATE = 0.2;
export const DEFAULT_TAX_RATE = 0.16;

/**
 * @param {number} value
 * @param {number} [digits=2]
 * @returns {number}
 */
export function roundCurrency(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/**
 * @param {{ kind?: string, value?: number }|null|undefined} discount
 * @returns {{ kind: string, value: number }}
 */
export function normalizeDiscount(discount) {
  if (!discount) {
    return Object.freeze({ kind: DISCOUNT_KIND.NONE, value: 0 });
  }

  const kind = discount.kind ?? DISCOUNT_KIND.NONE;
  const numericValue = Number(discount.value ?? 0);

  if (!Object.values(DISCOUNT_KIND).includes(kind)) {
    throw new Error(`Unsupported discount kind: ${kind}`);
  }

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new RangeError('Discount value must be a finite non-negative number.');
  }

  return Object.freeze({ kind, value: numericValue });
}

/**
 * @param {number} baseAmount
 * @param {{ kind: string, value: number }} discount
 * @returns {number}
 */
export function computeDiscountAmount(baseAmount, discount) {
  const safeBase = Number(baseAmount);
  if (!Number.isFinite(safeBase) || safeBase < 0) {
    throw new RangeError('baseAmount must be a finite non-negative number.');
  }

  const safeDiscount = normalizeDiscount(discount);
  if (safeDiscount.kind === DISCOUNT_KIND.NONE || safeDiscount.value === 0) {
    return 0;
  }

  if (safeDiscount.kind === DISCOUNT_KIND.PERCENTAGE) {
    if (safeDiscount.value > 100) {
      throw new RangeError('Percentage discount cannot exceed 100.');
    }
    return roundCurrency(safeBase * (safeDiscount.value / 100));
  }

  return roundCurrency(Math.min(safeDiscount.value, safeBase));
}

/**
 * Compute total amount from an array of discount/fee entries.
 *
 * @param {number} base - The base amount that percentage entries are applied to
 * @param {Array<{ type: string, value: number }>} entries
 * @returns {number}
 */
export function computeEntriesTotal(base, entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  const safeBase = Math.max(0, Number(base) || 0);
  let total = 0;
  for (const entry of entries) {
    const val = Number(entry.value) || 0;
    if (entry.type === ENTRY_TYPE.PERCENTAGE) {
      total += roundCurrency(safeBase * (Math.min(val, 100) / 100));
    } else {
      total += roundCurrency(val);
    }
  }
  return roundCurrency(total);
}

/**
 * Normalize a single discount/fee entry.
 *
 * @param {{ id?: string, name?: string, type?: string, value?: number }} entry
 * @returns {{ id: string, name: string, type: string, value: number }}
 */
export function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Entry must be a valid object.');
  }
  const type = entry.type ?? ENTRY_TYPE.FIXED;
  if (!Object.values(ENTRY_TYPE).includes(type)) {
    throw new Error(`Unsupported entry type: ${type}`);
  }
  const value = Number(entry.value ?? 0);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Entry value must be a finite non-negative number.');
  }
  return Object.freeze({
    id: entry.id ?? `ent-${Math.random().toString(36).slice(2, 10)}`,
    name: String(entry.name ?? ''),
    type,
    value,
  });
}

/**
 * @param {{ createdAt?: string, updatedAt?: string, createdBy?: string|null, updatedBy?: string|null }} input
 * @returns {{ createdAt: string, updatedAt: string, createdBy: string|null, updatedBy: string|null }}
 */
export function createAuditFields(input = {}) {
  const nowIso = new Date().toISOString();
  const createdAt = input.createdAt ?? nowIso;
  const updatedAt = input.updatedAt ?? createdAt;

  return Object.freeze({
    createdAt,
    updatedAt,
    createdBy: input.createdBy ?? null,
    updatedBy: input.updatedBy ?? input.createdBy ?? null,
  });
}

/**
 * @param {Record<string, unknown>|null|undefined} extras
 * @returns {Record<string, unknown>}
 */
export function normalizeExtras(extras) {
  if (!extras || typeof extras !== 'object' || Array.isArray(extras)) {
    return Object.freeze({});
  }
  return Object.freeze({ ...extras });
}
