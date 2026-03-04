// ─────────────────────────────────────────────────────────────────────────────
//  Accessory Model
//
//  Accessories are either derived (computed from config) or explicit (user-
//  selected). They can be scoped to a rack line, a bay, or a specific level.
//
//  Reference: business_rules_racks.md — Section 10
// ─────────────────────────────────────────────────────────────────────────────

import { AccessoryCategory, AccessoryScope } from '../constants.js';

/**
 * @typedef {Object} AccessorySpec
 * @property {string}  id            - Catalog SKU / identifier
 * @property {string}  name          - Human-readable name
 * @property {string}  category      - DERIVED | EXPLICIT
 * @property {string}  scope         - RACK_LINE | BAY | LEVEL
 * @property {string}  [description] - Optional description
 */

/**
 * @typedef {Object} Accessory
 * @property {string}        id            - Unique instance identifier
 * @property {AccessorySpec} spec          - Reference to accessory specification
 * @property {number}        quantity      - Computed or specified quantity
 * @property {string|null}   targetBayId   - Bay id if scoped to BAY
 * @property {number|null}   targetLevelIndex - Level index if scoped to LEVEL
 */

/**
 * Create an accessory specification (catalog entry).
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.name
 * @param {string} params.category
 * @param {string} params.scope
 * @param {string} [params.description='']
 * @returns {Readonly<AccessorySpec>}
 */
export function createAccessorySpec({ id, name, category, scope, description = '' }) {
  if (!Object.values(AccessoryCategory).includes(category)) {
    throw new Error(`Invalid accessory category: ${category}`);
  }
  if (!Object.values(AccessoryScope).includes(scope)) {
    throw new Error(`Invalid accessory scope: ${scope}`);
  }

  return Object.freeze({ id, name, category, scope, description });
}

/**
 * Create an accessory instance.
 *
 * @param {Object} params
 * @param {string}        params.id
 * @param {AccessorySpec} params.spec
 * @param {number}        params.quantity
 * @param {string|null}   [params.targetBayId=null]
 * @param {number|null}   [params.targetLevelIndex=null]
 * @returns {Readonly<Accessory>}
 */
export function createAccessory({
  id,
  spec,
  quantity,
  targetBayId = null,
  targetLevelIndex = null,
}) {
  if (quantity < 0 || !Number.isInteger(quantity)) {
    throw new RangeError('Accessory quantity must be a non-negative integer.');
  }

  // Scope validation
  if (spec.scope === AccessoryScope.BAY && targetBayId == null) {
    throw new Error('targetBayId is required for BAY-scoped accessories.');
  }
  if (spec.scope === AccessoryScope.LEVEL && (targetBayId == null || targetLevelIndex == null)) {
    throw new Error('targetBayId and targetLevelIndex are required for LEVEL-scoped accessories.');
  }

  return Object.freeze({
    id,
    spec,
    quantity,
    targetBayId,
    targetLevelIndex,
  });
}
