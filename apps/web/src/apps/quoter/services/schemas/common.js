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
