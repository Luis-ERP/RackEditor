// ─────────────────────────────────────────────────────────────────────────────
//  Rack Domain — Business Rules Verification Tests
//
//  Verifies every rule from business_rules_racks.md against the implementation.
//  Run: node apps/web/app/services/rack/__tests__/rackDomain.test.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  // Constants
  HOLE_STEP_IN,
  MIN_BAY_COUNT,
  SAFETY_PINS_PER_BEAM,
  BEAMS_PER_LEVEL,
  ValidationState,
  RowConfiguration,
  LevelMode,
  BasePlateType,
  ANCHORS_PER_FRAME,

  // Models
  createFrameSpec,
  createFrame,
  frameHoleCount,
  maxHoleIndex,
  holeIndexToElevation,
  elevationToHoleIndex,
  frameCountFromBays,
  createBeamSpec,
  createBeamLevel,
  minimumGapSteps,
  validateLevelSpacing,
  isBeamCompatibleWithFrame,
  createBay,
  validateBayBeamLength,
  bayBeamCount,
  createRackModule,
  moduleBayCount,
  moduleFrameIndices,
  createRackLine,
  rackLineFrameIndices,
  rackLineAllBays,
  rackLineRowCount,
  withValidationState,
  createAccessorySpec,
  createAccessory,
  createDesignRevision,
  deriveRevision,

  // Factory
  resetIdCounter,
  buildBeamLevels,
  buildRackModule,
  buildRackLine,
  buildSimpleRackLine,
  buildMultiModuleRackLine,
  generateFrames,

  // Validation
  validateRackLine,
  validateDesignRevision,

  // BOM
  deriveRackLineBOM,
  deriveDesignRevisionBOM,

  // Accessories
  derivedAccessories,
  computeAllAccessories,
  resetAccessoryIdCounter,

  // Pricing
  computePricing,
} from '../index.js';

// ── Test Helpers ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(`${label} — expected ${expected}, got ${actual}`);
    console.error(`  ✗ FAIL: ${label} — expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    failed++;
    failures.push(`${label} — expected error, none thrown`);
    console.error(`  ✗ FAIL: ${label} — expected error`);
  } catch {
    passed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ── Test Fixtures ───────────────────────────────────────────────────────────

function makeFrameSpec(overrides = {}) {
  return createFrameSpec({
    id: 'FRM-240-48',
    heightIn: 240,
    depthIn: 48,
    gauge: '14GA',
    capacityClass: 'STANDARD',
    uprightSeries: 'T-BOLT',
    basePlateType: BasePlateType.STANDARD,
    ...overrides,
  });
}

function makeBeamSpec(overrides = {}) {
  return createBeamSpec({
    id: 'BM-96',
    lengthIn: 96,
    capacityClass: 'STANDARD',
    beamSeries: 'STEP',
    connectorType: 'T-BOLT',
    verticalEnvelopeIn: 8,
    compatibleUprightSeries: ['T-BOLT'],
    ...overrides,
  });
}

// ── Run Tests ───────────────────────────────────────────────────────────────

resetIdCounter();
resetAccessoryIdCounter();

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 2.1: Frames
// ═══════════════════════════════════════════════════════════════════════
section('Section 2.1 — Frames');

{
  const spec = makeFrameSpec();
  assert(spec.heightIn === 240, 'Frame height stored correctly');
  assert(spec.depthIn === 48, 'Frame depth stored correctly');
  assert(spec.uprightSeries === 'T-BOLT', 'Upright series stored');
  assert(Object.isFrozen(spec), 'FrameSpec is immutable');

  // frame_count = N + 1
  assertEqual(frameCountFromBays(5), 6, 'Sec 2.1: 5 bays → 6 frames');
  assertEqual(frameCountFromBays(1), 2, 'Sec 2.1: 1 bay → 2 frames');
  assertEqual(frameCountFromBays(10), 11, 'Sec 2.1: 10 bays → 11 frames');

  assertThrows(() => frameCountFromBays(0), 'Sec 11: 0 bays throws');
  assertThrows(() => frameCountFromBays(-1), 'Negative bay count throws');
  assertThrows(() => createFrameSpec({ ...spec, heightIn: 0 }), 'Zero height throws');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 3: Frame Hole Pattern
// ═══════════════════════════════════════════════════════════════════════
section('Section 3 — Hole Pattern');

{
  assertEqual(HOLE_STEP_IN, 2, 'Sec 3: hole step = 2 inches');

  assertEqual(holeIndexToElevation(0), 0, 'Hole 0 → 0"');
  assertEqual(holeIndexToElevation(1), 2, 'Hole 1 → 2"');
  assertEqual(holeIndexToElevation(10), 20, 'Hole 10 → 20"');
  assertEqual(holeIndexToElevation(60), 120, 'Hole 60 → 120"');

  assertEqual(elevationToHoleIndex(0), 0, '0" → hole 0');
  assertEqual(elevationToHoleIndex(20), 10, '20" → hole 10');
  assertEqual(elevationToHoleIndex(3), null, '3" not on grid → null');

  assertThrows(() => holeIndexToElevation(-1), 'Negative hole index throws');
  assertThrows(() => holeIndexToElevation(1.5), 'Non-integer hole index throws');

  const spec = makeFrameSpec({ heightIn: 240 });
  assertEqual(maxHoleIndex(spec), 120, 'Sec 3: 240" frame → max hole 120');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 4 & 5: Beam Connector Envelope & Minimum Vertical Distance
// ═══════════════════════════════════════════════════════════════════════
section('Section 4 & 5 — Beam Envelope & Minimum Gap');

{
  const beam8 = makeBeamSpec({ verticalEnvelopeIn: 8 });
  const beam10 = makeBeamSpec({ id: 'BM-96-HVY', verticalEnvelopeIn: 10 });

  // minimum_gap = 2 + max(10, 8) = 12" → ceil(12/2) = 6 holes
  assertEqual(minimumGapSteps(beam10, beam8), 6, 'Sec 5: envelope 10+8 → 6 hole gap');

  // minimum_gap = 2 + max(8, 8) = 10" → ceil(10/2) = 5 holes
  assertEqual(minimumGapSteps(beam8, beam8), 5, 'Sec 5: envelope 8+8 → 5 hole gap');

  // Odd envelope: 2 + max(7, 8) = 10" → ceil(10/2) = 5
  const beam7 = makeBeamSpec({ id: 'BM-96-7', verticalEnvelopeIn: 7 });
  assertEqual(minimumGapSteps(beam7, beam8), 5, 'Sec 5: envelope 7+8 → 5 hole gap');

  // Exact section 5 example: lower=10, upper=8 → 6
  assertEqual(minimumGapSteps(beam10, beam8), 6, 'Sec 5 example: 6 holes');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 6: Level Ordering Rules
// ═══════════════════════════════════════════════════════════════════════
section('Section 6 — Level Ordering');

{
  const beam = makeBeamSpec({ verticalEnvelopeIn: 8 });
  // min gap = ceil((2+8)/2) = 5

  // Valid: levels at holes 10, 15, 20 (gaps = 5 each, meets minimum)
  const validLevels = [
    createBeamLevel({ id: 'l0', levelIndex: 0, holeIndex: 10, beamSpec: beam }),
    createBeamLevel({ id: 'l1', levelIndex: 1, holeIndex: 15, beamSpec: beam }),
    createBeamLevel({ id: 'l2', levelIndex: 2, holeIndex: 20, beamSpec: beam }),
  ];
  const validErrors = validateLevelSpacing(validLevels);
  assertEqual(validErrors.length, 0, 'Sec 6: Properly spaced levels are valid');

  // Invalid: levels too close (gap = 3 < 5)
  const tooClose = [
    createBeamLevel({ id: 'l0', levelIndex: 0, holeIndex: 10, beamSpec: beam }),
    createBeamLevel({ id: 'l1', levelIndex: 1, holeIndex: 13, beamSpec: beam }),
  ];
  const closeErrors = validateLevelSpacing(tooClose);
  assert(closeErrors.length > 0, 'Sec 6: Too-close levels produce errors');

  // Invalid: non-strictly-increasing
  const sameHole = [
    createBeamLevel({ id: 'l0', levelIndex: 0, holeIndex: 10, beamSpec: beam }),
    createBeamLevel({ id: 'l1', levelIndex: 1, holeIndex: 10, beamSpec: beam }),
  ];
  const sameErrors = validateLevelSpacing(sameHole);
  assert(sameErrors.length > 0, 'Sec 6: Same hole index produces errors');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 7: Frame Height Constraints
// ═══════════════════════════════════════════════════════════════════════
section('Section 7 — Frame Height Constraints');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec({ heightIn: 240 }); // max hole = 120
  const beamSpec = makeBeamSpec();

  // Build a line where top level exceeds frame height
  const invalidLine = buildSimpleRackLine({
    frameSpec,
    beamSpec,
    bayCount: 1,
    holeIndices: [10, 130], // hole 130 → 260" > 240"
  });
  const result = validateRackLine(invalidLine);
  assert(result.state === ValidationState.INVALID, 'Sec 7: Level exceeding frame height → INVALID');
  assert(result.errors.some(e => e.code === 'LEVEL_EXCEEDS_FRAME_HEIGHT'), 'Sec 7: Error code present');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 8: Floor Clearance
// ═══════════════════════════════════════════════════════════════════════
section('Section 8 — Floor Clearance');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  const line = buildSimpleRackLine({
    frameSpec,
    beamSpec,
    bayCount: 1,
    holeIndices: [2, 20], // hole 2 → 4" elevation
  });

  // With 6" floor clearance requirement, 4" should fail
  const result = validateRackLine(line, { minimumFloorClearanceIn: 6 });
  assert(
    result.errors.some(e => e.code === 'INSUFFICIENT_FLOOR_CLEARANCE'),
    'Sec 8: First level below floor clearance → error'
  );

  // With 4" floor clearance, 4" should pass
  const result2 = validateRackLine(line, { minimumFloorClearanceIn: 4 });
  assert(
    !result2.errors.some(e => e.code === 'INSUFFICIENT_FLOOR_CLEARANCE'),
    'Sec 8: First level at exact floor clearance → no error'
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 9: Rack Line Configurations
// ═══════════════════════════════════════════════════════════════════════
section('Section 9 — Rack Line Configurations');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  // |=| → 1 module, 1 bay, 2 frames
  const line1 = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 1, holeIndices: [10, 30],
  });
  assertEqual(line1.totalBayCount, 1, 'Sec 9: |=| → 1 bay');
  assertEqual(line1.totalFrameCount, 2, 'Sec 9: |=| → 2 frames');

  // |=|=| → 1 module, 2 bays, 3 frames
  resetIdCounter();
  const line2 = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30],
  });
  assertEqual(line2.totalBayCount, 2, 'Sec 9: |=|=| → 2 bays');
  assertEqual(line2.totalFrameCount, 3, 'Sec 9: |=|=| → 3 frames');

  // |=|=| |=| → 2 modules (2 bays + 1 bay), sharing middle frame → 4 frames
  resetIdCounter();
  const line3 = buildMultiModuleRackLine({
    moduleConfigs: [
      { frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30] },
      { frameSpec, beamSpec, bayCount: 1, holeIndices: [10, 30] },
    ],
  });
  assertEqual(line3.totalBayCount, 3, 'Sec 9: |=|=| |=| → 3 bays');
  assertEqual(line3.totalFrameCount, 4, 'Sec 9: |=|=| |=| → 4 frames (shared middle)');
  assertEqual(line3.modules.length, 2, 'Sec 9: 2 modules');

  // Invalid: empty module list
  assertThrows(
    () => buildRackLine({ moduleConfigs: [] }),
    'Sec 9: Empty module list throws'
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 9.1 & 9.2: Single Row & Back-to-Back
// ═══════════════════════════════════════════════════════════════════════
section('Section 9.1 & 9.2 — Row Configurations');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  // Single row
  const single = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 3, holeIndices: [10, 30],
    rowConfiguration: RowConfiguration.SINGLE,
  });
  assertEqual(rackLineRowCount(single), 1, 'Sec 9.1: Single → 1 row');

  // Back-to-back 2
  resetIdCounter();
  const btb2 = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 3, holeIndices: [10, 30],
    rowConfiguration: RowConfiguration.BACK_TO_BACK_2,
    backToBackConfig: { rowSpacerSizeIn: 6, rowCount: 2 },
  });
  assertEqual(rackLineRowCount(btb2), 2, 'Sec 9.2: Back-to-back-2 → 2 rows');

  // Back-to-back requires config
  assertThrows(
    () => createRackLine({
      id: 'x',
      modules: single.modules,
      rowConfiguration: RowConfiguration.BACK_TO_BACK_2,
    }),
    'Sec 9.2: Back-to-back without config throws'
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 10: Accessories
// ═══════════════════════════════════════════════════════════════════════
section('Section 10 — Accessories');

{
  resetIdCounter();
  resetAccessoryIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  const line = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30],
  });

  const accessories = derivedAccessories(line);
  assert(accessories.length > 0, 'Sec 10.1: Derived accessories are generated');

  // Anchors: 3 frames × 2 anchors per STANDARD base plate = 6
  const anchors = accessories.find(a => a.spec.name === 'Base Plate Anchor');
  assertEqual(anchors.quantity, 6, 'Sec 10.1: 3 frames × 2 anchors = 6');

  // Safety pins: 2 bays × 2 levels × 2 beams/level × 2 pins/beam = 16
  const pins = accessories.find(a => a.spec.name === 'Beam Safety Pin');
  assertEqual(pins.quantity, 16, 'Sec 10.1: 2×2×2×2 = 16 safety pins');

  // Back-to-back row spacers
  resetIdCounter();
  resetAccessoryIdCounter();
  const btbLine = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30],
    rowConfiguration: RowConfiguration.BACK_TO_BACK_2,
    backToBackConfig: { rowSpacerSizeIn: 6, rowCount: 2 },
  });
  const btbAcc = derivedAccessories(btbLine);
  const spacers = btbAcc.find(a => a.spec.name === 'Row Spacer');
  assert(spacers != null, 'Sec 10.1: Row spacers derived for back-to-back');
  assertEqual(spacers.quantity, 3, 'Sec 10.1: 3 frame positions × 1 row pair = 3 spacers');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 11: Bay Count Rules
// ═══════════════════════════════════════════════════════════════════════
section('Section 11 — Bay Count Rules');

{
  assertEqual(MIN_BAY_COUNT, 1, 'Sec 11: Minimum bay count = 1');
  assertThrows(
    () => buildRackModule({
      frameSpec: makeFrameSpec(),
      beamSpec: makeBeamSpec(),
      bayCount: 0,
      holeIndices: [10],
    }),
    'Sec 11: 0 bays throws'
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 12: Beam Compatibility
// ═══════════════════════════════════════════════════════════════════════
section('Section 12 — Beam Compatibility');

{
  const beam = makeBeamSpec({ compatibleUprightSeries: ['T-BOLT'] });
  assert(isBeamCompatibleWithFrame(beam, 'T-BOLT'), 'Sec 12: Compatible beam+frame → true');
  assert(!isBeamCompatibleWithFrame(beam, 'TEARDROP'), 'Sec 12: Incompatible → false');

  // Factory should reject incompatible beam+frame
  assertThrows(
    () => buildRackModule({
      frameSpec: makeFrameSpec({ uprightSeries: 'TEARDROP' }),
      beamSpec: makeBeamSpec({ compatibleUprightSeries: ['T-BOLT'] }),
      bayCount: 1,
      holeIndices: [10],
    }),
    'Sec 12: Factory rejects incompatible beam+frame'
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 13: Level Uniformity
// ═══════════════════════════════════════════════════════════════════════
section('Section 13 — Level Uniformity');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  // Uniform mode
  const uniformLine = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 3, holeIndices: [10, 30],
  });
  assertEqual(uniformLine.levelMode, LevelMode.UNIFORM, 'Sec 13: Simple line → UNIFORM');

  // Variable mode (multi-module)
  resetIdCounter();
  const variableLine = buildMultiModuleRackLine({
    moduleConfigs: [
      { frameSpec, beamSpec, bayCount: 1, holeIndices: [10, 30] },
      { frameSpec, beamSpec, bayCount: 1, holeIndices: [12, 35] },
    ],
  });
  assertEqual(variableLine.levelMode, LevelMode.VARIABLE, 'Sec 13: Multi-module → VARIABLE');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 14: Validation States
// ═══════════════════════════════════════════════════════════════════════
section('Section 14 — Validation States');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  // VALID
  const validLine = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30],
  });
  const validResult = validateRackLine(validLine);
  assertEqual(validResult.state, ValidationState.VALID, 'Sec 14: Valid config → VALID');

  // INVALID (levels too close)
  resetIdCounter();
  const invalidLine = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 1, holeIndices: [10, 12], // gap 2 < min 5
  });
  const invalidResult = validateRackLine(invalidLine);
  assertEqual(invalidResult.state, ValidationState.INVALID, 'Sec 14: Invalid config → INVALID');
  assert(invalidResult.errors.length > 0, 'Sec 14: INVALID has errors');

  // VALID_WITH_WARNINGS (near frame top)
  resetIdCounter();
  const warnLine = buildSimpleRackLine({
    frameSpec: makeFrameSpec({ heightIn: 42 }), // Tight: top hole at 42, test level at 20 → 40"
    beamSpec,
    bayCount: 1,
    holeIndices: [5, 20], // 20×2=40", frame height=42", remaining=2" → warning
  });
  const warnResult = validateRackLine(warnLine);
  assertEqual(warnResult.state, ValidationState.VALID_WITH_WARNINGS, 'Sec 14: Near-top warning → VALID_WITH_WARNINGS');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 15: Design Revision
// ═══════════════════════════════════════════════════════════════════════
section('Section 15 — Design Revisions');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  const line = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30],
  });

  const rev1 = createDesignRevision({
    id: 'rev-001',
    revisionNumber: 1,
    catalogVersion: 'CAT-2026-Q1',
    rackLines: [line],
  });

  assertEqual(rev1.revisionNumber, 1, 'Sec 15: Revision number = 1');
  assert(Object.isFrozen(rev1), 'Sec 15: Revision is frozen (immutable)');
  assert(rev1.bomSnapshot === null, 'Sec 15: Initial BOM is null');

  // Derive new revision
  const rev2 = deriveRevision(rev1, { id: 'rev-002' });
  assertEqual(rev2.revisionNumber, 2, 'Sec 15: Derived revision = 2');
  assert(rev2.bomSnapshot === null, 'Sec 15: Derived revision clears BOM');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 16: BOM Derivation
// ═══════════════════════════════════════════════════════════════════════
section('Section 16 — BOM Derivation');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  // 3 bays, 2 levels → 4 frames, 3×2×2=12 beams, 12×2=24 safety pins, 4×2=8 anchors
  const line = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 3, holeIndices: [10, 30],
  });

  const bom = deriveRackLineBOM(line, 'CAT-2026-Q1');
  assert(bom.items.length > 0, 'Sec 16: BOM has items');
  assertEqual(bom.catalogVersion, 'CAT-2026-Q1', 'Sec 16: Catalog version stored');

  const frameItem = bom.items.find(i => i.sku === frameSpec.id);
  assertEqual(frameItem.quantity, 4, 'Sec 16: 3 bays → 4 frames');

  const beamItem = bom.items.find(i => i.sku === beamSpec.id);
  assertEqual(beamItem.quantity, 12, 'Sec 16: 3 bays × 2 levels × 2 = 12 beams');

  const pinItem = bom.items.find(i => i.sku === 'ACC-SAFETY-PIN');
  assertEqual(pinItem.quantity, 24, 'Sec 16: 12 beams × 2 = 24 safety pins');

  const anchorItem = bom.items.find(i => i.name.includes('Anchor'));
  assertEqual(anchorItem.quantity, 8, 'Sec 16: 4 frames × 2 = 8 anchors');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 17: Pricing Rule
// ═══════════════════════════════════════════════════════════════════════
section('Section 17 — Pricing');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  const line = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 1, holeIndices: [10, 30],
  });

  const bom = deriveRackLineBOM(line, 'CAT-2026-Q1');

  const pricingTable = {
    version: 'PRICE-2026-Q1',
    unitPrices: {
      'FRM-240-48': 150.00,
      'BM-96': 45.00,
      'ACC-SAFETY-PIN': 0.50,
      'ACC-ANCHOR-STANDARD': 3.00,
    },
  };

  const pricing = computePricing(bom, pricingTable);
  assertEqual(pricing.pricingVersion, 'PRICE-2026-Q1', 'Sec 17: Pricing version stored');
  assert(pricing.subtotal > 0, 'Sec 17: Subtotal is positive');
  assert(pricing.items.length > 0, 'Sec 17: Priced items returned');

  // Determinism: same inputs → same output
  const pricing2 = computePricing(bom, pricingTable);
  assertEqual(pricing.subtotal, pricing2.subtotal, 'Sec 19: Same inputs → same subtotal');

  // Manual override
  const pricing3 = computePricing(bom, pricingTable, { 'FRM-240-48': 999.99 });
  const overriddenFrame = pricing3.items.find(i => i.sku === 'FRM-240-48');
  assertEqual(overriddenFrame.lineTotal, 999.99, 'Sec 17: Manual override applied');
  assert(overriddenFrame.isOverridden, 'Sec 17: Override flag set');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 18: Canvas Representation Rule
// ═══════════════════════════════════════════════════════════════════════
section('Section 18 — Canvas Separation');

{
  // Verify no CAD/position/orientation properties exist on domain models
  const frameSpec = makeFrameSpec();
  assert(!('x' in frameSpec), 'Sec 18: No x in FrameSpec');
  assert(!('y' in frameSpec), 'Sec 18: No y in FrameSpec');
  assert(!('position' in frameSpec), 'Sec 18: No position in FrameSpec');
  assert(!('orientation' in frameSpec), 'Sec 18: No orientation in FrameSpec');
  assert(!('rotation' in frameSpec), 'Sec 18: No rotation in FrameSpec');

  const beamSpec = makeBeamSpec();
  assert(!('x' in beamSpec), 'Sec 18: No x in BeamSpec');
  assert(!('position' in beamSpec), 'Sec 18: No position in BeamSpec');

  resetIdCounter();
  const line = buildSimpleRackLine({
    frameSpec, beamSpec: makeBeamSpec(), bayCount: 1, holeIndices: [10, 30],
  });
  assert(!('x' in line), 'Sec 18: No x in RackLine');
  assert(!('position' in line), 'Sec 18: No position in RackLine');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 19: Determinism Requirement
// ═══════════════════════════════════════════════════════════════════════
section('Section 19 — Determinism');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  const line = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30],
  });

  const bom1 = deriveRackLineBOM(line, 'CAT-V1');
  const bom2 = deriveRackLineBOM(line, 'CAT-V1');

  // Same quantities for all items
  for (let i = 0; i < bom1.items.length; i++) {
    assertEqual(
      bom1.items[i].quantity,
      bom2.items[i].quantity,
      `Sec 19: BOM item[${i}] quantity deterministic`
    );
    assertEqual(
      bom1.items[i].sku,
      bom2.items[i].sku,
      `Sec 19: BOM item[${i}] SKU deterministic`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ADDITIONAL: Frame Instance Generation
// ═══════════════════════════════════════════════════════════════════════
section('Additional — Frame Generation');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  const line = buildMultiModuleRackLine({
    moduleConfigs: [
      { frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30] },
      { frameSpec, beamSpec, bayCount: 1, holeIndices: [10, 30] },
    ],
  });

  const frames = generateFrames(line);
  assertEqual(frames.length, 4, 'Multi-module: 4 unique frames (shared middle)');

  const indices = frames.map(f => f.positionIndex);
  assert(indices[0] === 0, 'Frame indices start at 0');
  assert(indices[3] === 3, 'Frame indices end at 3');
}

// ═══════════════════════════════════════════════════════════════════════
//  ADDITIONAL: Design Revision Validation
// ═══════════════════════════════════════════════════════════════════════
section('Additional — Design Revision Validation');

{
  resetIdCounter();
  const frameSpec = makeFrameSpec();
  const beamSpec = makeBeamSpec();

  const validLine = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 2, holeIndices: [10, 30],
  });

  resetIdCounter();
  const invalidLine = buildSimpleRackLine({
    frameSpec, beamSpec, bayCount: 1, holeIndices: [10, 12],
  });

  const rev = createDesignRevision({
    id: 'rev-test',
    revisionNumber: 1,
    catalogVersion: 'CAT-V1',
    rackLines: [validLine, invalidLine],
  });

  const { overallState, lineResults } = validateDesignRevision(rev);
  assertEqual(overallState, ValidationState.INVALID, 'Revision with any invalid line → INVALID');
  assert(lineResults.size === 2, 'Validation results for each line');
}

// ═══════════════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
}

console.log('\n✓ All business rule verifications passed.\n');
