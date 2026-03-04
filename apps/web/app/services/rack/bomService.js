// ─────────────────────────────────────────────────────────────────────────────
//  BOM Derivation Service
//
//  The Bill of Materials is a deterministic function of:
//    - Rack configuration
//    - Catalog version
//    - Accessory derivation rules
//
//  Given the same DesignRevision + CatalogVersion, the BOM must always
//  be identical. (Section 16, 19)
//
//  Reference: business_rules_racks.md — Section 16
// ─────────────────────────────────────────────────────────────────────────────

import {
  BEAMS_PER_LEVEL,
  SAFETY_PINS_PER_BEAM,
  ANCHORS_PER_FRAME,
  BasePlateType,
} from './constants.js';

import { rackLineAllBays, rackLineFrameIndices, rackLineRowCount } from './models/rackLine.js';
import { bayBeamCount } from './models/bay.js';

/**
 * @typedef {Object} BOMLineItem
 * @property {string}  sku       - Catalog SKU
 * @property {string}  name      - Human-readable component name
 * @property {number}  quantity  - Deterministic count
 * @property {string}  unit      - Unit of measure (e.g. 'ea', 'pair')
 * @property {string}  [rule]    - Business rule that derived this quantity
 */

/**
 * @typedef {Object} BOMSnapshot
 * @property {BOMLineItem[]} items         - All line items
 * @property {string}        catalogVersion - Catalog version reference
 * @property {string}        generatedAt   - ISO timestamp
 */

/**
 * Derive the BOM for a single rack line.
 *
 * Deterministic derivation (Section 16):
 *   frames       = total frame count
 *   beams        = bay_count × levels × 2
 *   safety_pins  = beams × 2
 *   anchors      = frame_count × anchors_per_frame
 *
 * @param {import('./models/rackLine.js').RackLine} rackLine
 * @param {string} catalogVersion
 * @returns {BOMSnapshot}
 */
export function deriveRackLineBOM(rackLine, catalogVersion) {
  const items = [];
  const allBays = rackLineAllBays(rackLine);
  const frameIndices = rackLineFrameIndices(rackLine);
  const rowCount = rackLineRowCount(rackLine);

  // ── Frames ────────────────────────────────────────────────────
  // Each unique frame position × row count (back-to-back duplicates frames)
  const frameSpecs = new Map(); // specId → { spec, count }
  for (const mod of rackLine.modules) {
    const modFrameCount = mod.frameCount;
    const specId = mod.frameSpec.id;
    const existing = frameSpecs.get(specId) || { spec: mod.frameSpec, count: 0 };
    existing.count += modFrameCount;
    frameSpecs.set(specId, existing);
  }

  // Adjust for shared frames between modules: subtract overlap
  // When two modules share a frame, we counted it twice
  const sharedFrameCount = rackLine.modules.length > 1
    ? rackLine.modules.length - 1
    : 0;

  for (const [specId, { spec, count }] of frameSpecs) {
    const adjustedCount = (count - sharedFrameCount) * rowCount;
    items.push({
      sku: spec.id,
      name: `Frame ${spec.heightIn}" × ${spec.depthIn}" (${spec.uprightSeries})`,
      quantity: adjustedCount,
      unit: 'ea',
      rule: `frame_count=${frameIndices.length} × rows=${rowCount}`,
    });
  }

  // ── Beams ─────────────────────────────────────────────────────
  // Each bay has levels × 2 beams per row
  const beamSpecs = new Map(); // specId → { spec, count }
  for (const bay of allBays) {
    for (const level of bay.levels) {
      const specId = level.beamSpec.id;
      const existing = beamSpecs.get(specId) || { spec: level.beamSpec, count: 0 };
      existing.count += BEAMS_PER_LEVEL; // 2 beams per level (left + right)
      beamSpecs.set(specId, existing);
    }
  }

  let totalBeams = 0;
  for (const [specId, { spec, count }] of beamSpecs) {
    const beamQty = count * rowCount;
    totalBeams += beamQty;
    items.push({
      sku: spec.id,
      name: `Beam ${spec.lengthIn}" (${spec.beamSeries})`,
      quantity: beamQty,
      unit: 'ea',
      rule: `bay_count × levels × ${BEAMS_PER_LEVEL} × rows=${rowCount}`,
    });
  }

  // ── Safety Pins ───────────────────────────────────────────────
  // safety_pins = beams × 2 (Section 10.1)
  const safetyPinCount = totalBeams * SAFETY_PINS_PER_BEAM;
  if (safetyPinCount > 0) {
    items.push({
      sku: 'ACC-SAFETY-PIN',
      name: 'Safety Pin',
      quantity: safetyPinCount,
      unit: 'ea',
      rule: `total_beams=${totalBeams} × ${SAFETY_PINS_PER_BEAM}`,
    });
  }

  // ── Anchors ───────────────────────────────────────────────────
  // anchors_per_frame × frame_count (Section 10.1)
  for (const mod of rackLine.modules) {
    const basePlateType = mod.frameSpec.basePlateType || BasePlateType.STANDARD;
    const anchorsPerFrame = ANCHORS_PER_FRAME[basePlateType] || 2;
    const anchorCount = frameIndices.length * anchorsPerFrame * rowCount;

    items.push({
      sku: `ACC-ANCHOR-${basePlateType}`,
      name: `Anchor (${basePlateType})`,
      quantity: anchorCount,
      unit: 'ea',
      rule: `frames=${frameIndices.length} × anchors_per_frame=${anchorsPerFrame} × rows=${rowCount}`,
    });

    break; // One anchor entry per line (all frames assumed same base plate type)
  }

  // ── Row Spacers (Back-to-Back only) ───────────────────────────
  if (rowCount > 1) {
    // Row spacers typically pair frames across rows
    const rowSpacerCount = frameIndices.length * (rowCount - 1);
    items.push({
      sku: 'ACC-ROW-SPACER',
      name: 'Row Spacer',
      quantity: rowSpacerCount,
      unit: 'ea',
      rule: `frame_positions=${frameIndices.length} × (rows-1)=${rowCount - 1}`,
    });
  }

  return Object.freeze({
    items: Object.freeze(items.map((item) => Object.freeze(item))),
    catalogVersion,
    generatedAt: new Date().toISOString(),
  });
}

/**
 * Derive the BOM for an entire design revision (all rack lines).
 *
 * @param {import('./models/designRevision.js').DesignRevision} revision
 * @returns {BOMSnapshot}
 */
export function deriveDesignRevisionBOM(revision) {
  const allItems = [];

  for (const line of revision.rackLines) {
    const lineBOM = deriveRackLineBOM(line, revision.catalogVersion);
    allItems.push(...lineBOM.items);
  }

  // Merge identical SKUs
  const merged = new Map();
  for (const item of allItems) {
    const existing = merged.get(item.sku);
    if (existing) {
      merged.set(item.sku, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        rule: `${existing.rule} + ${item.rule}`,
      });
    } else {
      merged.set(item.sku, { ...item });
    }
  }

  return Object.freeze({
    items: Object.freeze([...merged.values()].map((item) => Object.freeze(item))),
    catalogVersion: revision.catalogVersion,
    generatedAt: new Date().toISOString(),
  });
}
