// ─────────────────────────────────────────────────────────────────────────────
//  Pricing Service
//
//  Pricing is a deterministic function of:
//    - BOM snapshot
//    - Pricing version
//    - Manual overrides
//
//  Pricing changes must never alter historical quotes.
//  Quotes must reference a pricing version. (Section 17)
//
//  Reference: business_rules_racks.md — Sections 17, 19
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PricedLineItem
 * @property {string}  sku          - Catalog SKU
 * @property {string}  name         - Component name
 * @property {number}  quantity     - From BOM
 * @property {number}  unitPrice    - Price per unit from pricing table
 * @property {number}  lineTotal    - quantity × unitPrice (or overridden)
 * @property {boolean} isOverridden - Whether a manual override was applied
 */

/**
 * @typedef {Object} PricingResult
 * @property {PricedLineItem[]} items          - Priced line items
 * @property {number}           subtotal       - Sum of all lineTotals
 * @property {string}           pricingVersion - Pricing version reference
 * @property {string}           generatedAt    - ISO timestamp
 */

/**
 * @typedef {Object} PricingTable
 * @property {string} version                          - Pricing version identifier
 * @property {Map<string, number>|Object} unitPrices   - SKU → unit price mapping
 */

/**
 * Compute pricing for a BOM snapshot against a pricing table.
 *
 * Determinism guarantee (Section 19):
 *   Given the same BOM + PricingVersion → identical pricing totals.
 *
 * @param {import('./bomService.js').BOMSnapshot} bomSnapshot
 * @param {PricingTable} pricingTable
 * @param {Map<string, number>|Object} [manualOverrides={}] - SKU → overridden line total
 * @returns {PricingResult}
 */
export function computePricing(bomSnapshot, pricingTable, manualOverrides = {}) {
  const overrideMap = manualOverrides instanceof Map
    ? manualOverrides
    : new Map(Object.entries(manualOverrides));

  const unitPriceMap = pricingTable.unitPrices instanceof Map
    ? pricingTable.unitPrices
    : new Map(Object.entries(pricingTable.unitPrices));

  const items = [];
  let subtotal = 0;

  for (const bomItem of bomSnapshot.items) {
    const unitPrice = unitPriceMap.get(bomItem.sku) || 0;
    const isOverridden = overrideMap.has(bomItem.sku);
    const lineTotal = isOverridden
      ? overrideMap.get(bomItem.sku)
      : bomItem.quantity * unitPrice;

    subtotal += lineTotal;

    items.push(Object.freeze({
      sku: bomItem.sku,
      name: bomItem.name,
      quantity: bomItem.quantity,
      unitPrice,
      lineTotal,
      isOverridden,
    }));
  }

  return Object.freeze({
    items: Object.freeze(items),
    subtotal,
    pricingVersion: pricingTable.version,
    generatedAt: new Date().toISOString(),
  });
}
