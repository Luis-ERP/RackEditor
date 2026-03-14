// ─────────────────────────────────────────────────────────────────────────────
//  Design Revision Model
//
//  All rack configurations exist within a design revision.
//  Revisions are immutable snapshots. Edits require a new revision.
//
//  Reference: business_rules_racks.md — Section 15
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DesignRevision
 * @property {string}  id                - Unique revision identifier
 * @property {number}  revisionNumber    - Monotonically increasing revision number
 * @property {string}  catalogVersion    - Catalog version used for this revision
 * @property {import('./rackLine.js').RackLine[]} rackLines - All rack lines in this revision
 * @property {import('./accessory.js').Accessory[]} accessories - All accessory instances
 * @property {Object}  validationResults - Aggregated validation results
 * @property {Object|null} bomSnapshot   - Derived BOM snapshot (null until computed)
 * @property {string}  createdAt         - ISO timestamp
 */

/**
 * Create a new design revision.
 *
 * Immutability contract (Section 15):
 *   Given the same DesignRevision + CatalogVersion → identical BOM.
 *
 * @param {Object} params
 * @param {string}  params.id
 * @param {number}  params.revisionNumber
 * @param {string}  params.catalogVersion
 * @param {import('./rackLine.js').RackLine[]} params.rackLines
 * @param {import('./accessory.js').Accessory[]} [params.accessories=[]]
 * @param {Object}  [params.validationResults={}]
 * @param {Object|null} [params.bomSnapshot=null]
 * @returns {Readonly<DesignRevision>}
 */
export function createDesignRevision({
  id,
  revisionNumber,
  catalogVersion,
  rackLines,
  accessories = [],
  validationResults = {},
  bomSnapshot = null,
}) {
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    throw new RangeError('revisionNumber must be a positive integer.');
  }

  return Object.freeze({
    id,
    revisionNumber,
    catalogVersion,
    rackLines: Object.freeze([...rackLines]),
    accessories: Object.freeze([...accessories]),
    validationResults: Object.freeze({ ...validationResults }),
    bomSnapshot: bomSnapshot ? Object.freeze({ ...bomSnapshot }) : null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Create a new design revision from an existing one (copy-on-edit).
 * Increments the revision number and clears the BOM snapshot (must be recomputed).
 *
 * @param {DesignRevision} prev
 * @param {Object} overrides — Any fields to override in the new revision
 * @returns {Readonly<DesignRevision>}
 */
export function deriveRevision(prev, overrides = {}) {
  return createDesignRevision({
    ...prev,
    id: overrides.id || `${prev.id}_r${prev.revisionNumber + 1}`,
    revisionNumber: prev.revisionNumber + 1,
    bomSnapshot: null, // must be recomputed
    ...overrides,
  });
}
