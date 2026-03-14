// ─────────────────────────────────────────────────────────────────────────────
//  Accessory Derivation Service
//
//  Derived accessories are automatically required based on configuration.
//  Explicit accessories are user-selected and stored as configuration inputs.
//
//  All derived quantities must be explainable from rules. (Section 10)
//
//  Reference: business_rules_racks.md — Section 10
// ─────────────────────────────────────────────────────────────────────────────

import {
  AccessoryCategory,
  AccessoryScope,
  SAFETY_PINS_PER_BEAM,
  BEAMS_PER_LEVEL,
  ANCHORS_PER_FRAME,
  BasePlateType,
} from './constants.js';

import { createAccessorySpec, createAccessory } from './models/accessory.js';
import { rackLineAllBays, rackLineFrameIndices, rackLineRowCount } from './models/rackLine.js';

let _accIdCounter = 0;
function nextAccId(prefix = 'acc') {
  return `${prefix}_${++_accIdCounter}`;
}

/** Reset ID counter (for testing). */
export function resetAccessoryIdCounter() {
  _accIdCounter = 0;
}

// ── Pre-defined Derived Accessory Specs ─────────────────────────────────────

const DERIVED_SPECS = Object.freeze({
  anchor: createAccessorySpec({
    id: 'SPEC-ANCHOR',
    name: 'Base Plate Anchor',
    category: AccessoryCategory.DERIVED,
    scope: AccessoryScope.RACK_LINE,
    description: 'Anchors per base plate (Section 10.1)',
  }),

  safetyPin: createAccessorySpec({
    id: 'SPEC-SAFETY-PIN',
    name: 'Beam Safety Pin',
    category: AccessoryCategory.DERIVED,
    scope: AccessoryScope.RACK_LINE,
    description: 'Safety pins per beam (Section 10.1)',
  }),

  beamLock: createAccessorySpec({
    id: 'SPEC-BEAM-LOCK',
    name: 'Beam Lock',
    category: AccessoryCategory.DERIVED,
    scope: AccessoryScope.RACK_LINE,
    description: 'Beam locks per beam connection',
  }),

  rowSpacer: createAccessorySpec({
    id: 'SPEC-ROW-SPACER',
    name: 'Row Spacer',
    category: AccessoryCategory.DERIVED,
    scope: AccessoryScope.RACK_LINE,
    description: 'Row spacers for back-to-back configurations (Section 10.1)',
  }),
});

export { DERIVED_SPECS };

// ─────────────────────────────────────────────────────────────────────────────
//  Derived Accessory Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute all derived accessories for a rack line.
 * These are deterministic — same config always produces same result. (Section 10.1)
 *
 * @param {import('./models/rackLine.js').RackLine} rackLine
 * @returns {import('./models/accessory.js').Accessory[]}
 */
export function derivedAccessories(rackLine) {
  const accessories = [];
  const frameIndices = rackLineFrameIndices(rackLine);
  const allBays = rackLineAllBays(rackLine);
  const rowCount = rackLineRowCount(rackLine);

  // ── Anchors ─────────────────────────────────────────────────────
  // anchors_per_frame = 2 or 4 depending on base plate type (Section 10.1)
  const basePlateType = rackLine.modules[0]?.frameSpec?.basePlateType || BasePlateType.STANDARD;
  const anchorsPerFrame = ANCHORS_PER_FRAME[basePlateType] || 2;
  const totalAnchors = frameIndices.length * anchorsPerFrame * rowCount;

  if (totalAnchors > 0) {
    accessories.push(createAccessory({
      id: nextAccId('anc'),
      spec: DERIVED_SPECS.anchor,
      quantity: totalAnchors,
    }));
  }

  // ── Safety Pins ─────────────────────────────────────────────────
  // safety_pins_per_beam = 2 (Section 10.1)
  let totalBeams = 0;
  for (const bay of allBays) {
    totalBeams += bay.levels.length * BEAMS_PER_LEVEL;
  }
  totalBeams *= rowCount;

  const totalSafetyPins = totalBeams * SAFETY_PINS_PER_BEAM;
  if (totalSafetyPins > 0) {
    accessories.push(createAccessory({
      id: nextAccId('sp'),
      spec: DERIVED_SPECS.safetyPin,
      quantity: totalSafetyPins,
    }));
  }

  // ── Beam Locks ──────────────────────────────────────────────────
  // One beam lock per beam (secures connector)
  if (totalBeams > 0) {
    accessories.push(createAccessory({
      id: nextAccId('bl'),
      spec: DERIVED_SPECS.beamLock,
      quantity: totalBeams,
    }));
  }

  // ── Row Spacers (Back-to-Back only) ─────────────────────────────
  // row_spacers_per_frame_pair = 1 per frame position per row pair
  if (rowCount > 1) {
    const rowSpacerCount = frameIndices.length * (rowCount - 1);
    accessories.push(createAccessory({
      id: nextAccId('rs'),
      spec: DERIVED_SPECS.rowSpacer,
      quantity: rowSpacerCount,
    }));
  }

  return accessories;
}

/**
 * Merge derived accessories with explicit (user-selected) accessories.
 *
 * @param {import('./models/accessory.js').Accessory[]} derived
 * @param {import('./models/accessory.js').Accessory[]} explicit_
 * @returns {import('./models/accessory.js').Accessory[]}
 */
export function mergeAccessories(derived, explicit_) {
  return [...derived, ...explicit_];
}

/**
 * Compute the complete accessory list for a rack line.
 *
 * @param {import('./models/rackLine.js').RackLine} rackLine
 * @param {import('./models/accessory.js').Accessory[]} [explicitAccessories=[]]
 * @returns {import('./models/accessory.js').Accessory[]}
 */
export function computeAllAccessories(rackLine, explicitAccessories = []) {
  const derived = derivedAccessories(rackLine);
  return mergeAccessories(derived, explicitAccessories);
}
