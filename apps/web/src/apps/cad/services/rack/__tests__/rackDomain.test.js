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

import {
  bindingFrameSpec,
  applyFrameOverrideAtIndex,
  applyFrameSpec,
  commitDraftToModule,
  clampHoleIndicesToFrame,
} from '../rackModuleEditorUtils.js';

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
    compatibleConnectorTypes: ['T-BOLT'],
    minimumTopClearanceIn: 6,
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
    profileHeightIn: 3,
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
  // Fixture beams: verticalEnvelopeIn varies, profileHeightIn=3 (from makeBeamSpec default)
  const beam8  = makeBeamSpec({ verticalEnvelopeIn: 8 });
  const beam10 = makeBeamSpec({ id: 'BM-96-HVY', verticalEnvelopeIn: 10 });

  // Sec 5 formula: minimum_gap_in = HOLE_STEP + max(lower_env, upper_env) + lower_profile
  // beam10 lower: 2 + max(10,8) + 3 = 15" → ceil(15/2) = 8 holes
  assertEqual(minimumGapSteps(beam10, beam8), 8, 'Sec 5: lower env=10 profile=3, upper env=8 → 8 hole gap');

  // beam8 lower: 2 + max(8,8) + 3 = 13" → ceil(13/2) = 7 holes
  assertEqual(minimumGapSteps(beam8, beam8), 7, 'Sec 5: lower env=8 profile=3, upper env=8 → 7 hole gap');

  // beam7 lower: 2 + max(7,8) + 3 = 13" → ceil(13/2) = 7 holes
  const beam7 = makeBeamSpec({ id: 'BM-96-7', verticalEnvelopeIn: 7 });
  assertEqual(minimumGapSteps(beam7, beam8), 7, 'Sec 5: lower env=7 profile=3, upper env=8 → 7 hole gap');

  // Exact Section 5 example from business rules:
  //   Lower beam: envelope=10", profile height=5"
  //   Upper beam: envelope=8",  profile height=4"
  //   minimum_gap_in = 2 + max(10, 8) + 5 = 17" → ceil(17/2) = 9 holes
  const exampleLower = makeBeamSpec({ id: 'lower', verticalEnvelopeIn: 10, profileHeightIn: 5 });
  const exampleUpper = makeBeamSpec({ id: 'upper', verticalEnvelopeIn: 8,  profileHeightIn: 4 });
  assertEqual(minimumGapSteps(exampleLower, exampleUpper), 9, 'Sec 5 business-rules example: 9 holes');
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 6: Level Ordering Rules
// ═══════════════════════════════════════════════════════════════════════
section('Section 6 — Level Ordering');

{
  const beam = makeBeamSpec({ verticalEnvelopeIn: 8 });
  // min gap = ceil((2 + 8 + 3) / 2) = ceil(13/2) = 7 holes (envelope=8, profileHeight=3)

  // Valid: levels at holes 10, 17, 24 (gaps = 7 each, meets minimum)
  const validLevels = [
    createBeamLevel({ id: 'l0', levelIndex: 0, holeIndex: 10, beamSpec: beam }),
    createBeamLevel({ id: 'l1', levelIndex: 1, holeIndex: 17, beamSpec: beam }),
    createBeamLevel({ id: 'l2', levelIndex: 2, holeIndex: 24, beamSpec: beam }),
  ];
  const validErrors = validateLevelSpacing(validLevels);
  assertEqual(validErrors.length, 0, 'Sec 6: Properly spaced levels are valid');

  // Invalid: levels too close (gap = 3 < 7)
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
  // Frame: height=60", minimumTopClearanceIn=4" → max allowed elevation = 56"
  // Top level at hole 28 → elevation 56" (≤ 56": no error) → remaining = 60-56 = 4" → NEAR_FRAME_TOP warning
  resetIdCounter();
  const warnLine = buildSimpleRackLine({
    frameSpec: makeFrameSpec({ heightIn: 60, minimumTopClearanceIn: 4 }),
    beamSpec,
    bayCount: 1,
    holeIndices: [5, 28], // elevations 10" and 56"; gap=23≥7, remaining=4" → warning
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
//  EDITOR UTILS: bindingFrameSpec & applyFrameOverrideAtIndex
// ═══════════════════════════════════════════════════════════════════════
section('Editor Utils — bindingFrameSpec');

{
  const short = makeFrameSpec({ id: 'FRM-SHORT', heightIn: 120 });
  const tall  = makeFrameSpec({ id: 'FRM-TALL',  heightIn: 240 });
  const beam  = makeBeamSpec();

  // No overrides → binding is the default spec
  const draft1 = { frameSpec: tall, frameOverrides: {}, beamLengthIn: 96, beamSpecs: [beam], holeIndices: [10] };
  assert(bindingFrameSpec(draft1) === tall, 'bindingFrameSpec: no overrides → default');

  // Override shorter than default → override is binding
  const draft2 = { ...draft1, frameOverrides: { 1: short } };
  assert(bindingFrameSpec(draft2) === short, 'bindingFrameSpec: shorter override → override is binding');

  // Override taller than default → default remains binding
  const draft3 = { ...draft1, frameSpec: short, frameOverrides: { 2: tall } };
  assert(bindingFrameSpec(draft3) === short, 'bindingFrameSpec: taller override → default is binding');

  // Multiple overrides → shortest wins
  const medium = makeFrameSpec({ id: 'FRM-MED', heightIn: 180 });
  const draft4 = { ...draft1, frameOverrides: { 0: medium, 2: short, 3: tall } };
  assert(bindingFrameSpec(draft4) === short, 'bindingFrameSpec: multiple overrides → shortest wins');

  // Missing frameSpec → null
  assert(bindingFrameSpec({ frameSpec: null, frameOverrides: {} }) === null, 'bindingFrameSpec: null frameSpec → null');
}

section('Editor Utils — applyFrameOverrideAtIndex');

{
  const default144 = makeFrameSpec({ id: 'FRM-144', heightIn: 144 });
  const tall192    = makeFrameSpec({ id: 'FRM-192', heightIn: 192 });
  const short96    = makeFrameSpec({ id: 'FRM-96',  heightIn: 96  });
  const beam       = makeBeamSpec();

  // Draft: 3 frames (2 bays), 2 beam levels at holes 10 and 20
  const baseDraft = {
    frameSpec: default144,
    frameOverrides: {},
    beamLengthIn: 96,
    beamSpecs: [beam, beam],
    holeIndices: [10, 20],
    bayCount: 2,
  };

  // Set a taller override — no beam level clamping expected
  const afterTall = applyFrameOverrideAtIndex(baseDraft, 1, tall192);
  assert(afterTall.frameOverrides[1] === tall192, 'applyFrameOverrideAtIndex: override stored at correct index');
  assertEqual(afterTall.holeIndices.length, 2, 'applyFrameOverrideAtIndex: taller override preserves all levels');
  assert(afterTall.frameSpec === default144, 'applyFrameOverrideAtIndex: default spec unchanged');

  // Set a shorter override (96") — beam levels at holes 10 and 20 exceed 96" frame max
  // 96" frame: maxHoleIndex = 48, minimumTopClearanceIn=6 → clearanceHoles=3 → maxAllowed=45
  // holes 10 and 20 both ≤ 45, so neither should be removed
  const afterShort = applyFrameOverrideAtIndex(baseDraft, 2, short96);
  assert(afterShort.frameOverrides[2] === short96, 'applyFrameOverrideAtIndex: short override stored');
  // Verify binding is now the short frame
  assert(bindingFrameSpec(afterShort) === short96, 'applyFrameOverrideAtIndex: binding updated to short override');

  // Set a very short override that forces level clamping
  // Frame 60" height → maxHoleIndex=30, minimumTopClearanceIn=6 → clearance=3 → maxAllowed=27
  // Level at hole 20 survives; hypothetical level at hole 30 would be removed
  const tiny60 = makeFrameSpec({ id: 'FRM-60', heightIn: 60, minimumTopClearanceIn: 6 });
  const draftWithHigh = { ...baseDraft, holeIndices: [10, 30], beamSpecs: [beam, beam] };
  const afterTiny = applyFrameOverrideAtIndex(draftWithHigh, 0, tiny60);
  // maxAllowed for 60" = 30 - ceil(6/2) = 30 - 3 = 27 → hole 30 is removed
  assert(!afterTiny.holeIndices.includes(30), 'applyFrameOverrideAtIndex: levels exceeding short frame are clamped');
  assert(afterTiny.holeIndices.includes(10),  'applyFrameOverrideAtIndex: levels within short frame are kept');

  // Clear an override (pass null) — default is restored
  const withOverride = applyFrameOverrideAtIndex(baseDraft, 1, tall192);
  const cleared = applyFrameOverrideAtIndex(withOverride, 1, null);
  assert(cleared.frameOverrides[1] == null, 'applyFrameOverrideAtIndex: null clears override');
  assert(Object.keys(cleared.frameOverrides).length === 0, 'applyFrameOverrideAtIndex: no overrides remain after clear');
}

section('Editor Utils — applyFrameSpec respects existing overrides');

{
  const default144 = makeFrameSpec({ id: 'FRM-144', heightIn: 144 });
  const short96    = makeFrameSpec({ id: 'FRM-96',  heightIn: 96  });
  const newDefault = makeFrameSpec({ id: 'FRM-192', heightIn: 192 });
  const beam       = makeBeamSpec();

  // Draft with a short override and levels that fit in 96"
  const draft = {
    frameSpec:      default144,
    frameOverrides: { 1: short96 },
    beamLengthIn:   96,
    beamSpecs:      [beam, beam],
    holeIndices:    [10, 20],
    bayCount:       2,
  };

  // Raising the default should keep the short override as binding — levels preserved
  const raised = applyFrameSpec(draft, newDefault);
  assertEqual(raised.holeIndices.length, 2, 'applyFrameSpec: raising default keeps levels (short override still binds)');
  assert(bindingFrameSpec(raised) === short96, 'applyFrameSpec: short override remains binding after default raised');
}

section('Editor Utils — commitDraftToModule preserves frameOverrides');

{
  resetIdCounter();
  const defaultSpec = makeFrameSpec({ id: 'FRM-144', heightIn: 144 });
  const overrideSpec = makeFrameSpec({ id: 'FRM-192', heightIn: 192 });
  const beam = makeBeamSpec();

  const draft = {
    frameSpec:        defaultSpec,
    frameOverrides:   { 1: overrideSpec },
    beamLengthIn:     96,
    beamSpecs:        [beam],
    holeIndices:      [10],
    bayCount:         2,
    rowConfiguration: RowConfiguration.SINGLE,
  };

  const mod = commitDraftToModule(draft, 0);
  assert(Object.isFrozen(mod), 'commitDraftToModule with overrides: module is frozen');
  assert(mod.frameSpec === defaultSpec, 'commitDraftToModule: default frameSpec stored');
  assert(mod.frameOverrides[1] === overrideSpec, 'commitDraftToModule: frameOverride at index 1 stored');
  assertEqual(mod.frameCount, 3, 'commitDraftToModule: 2 bays → 3 frames');
}

// ═══════════════════════════════════════════════════════════════════════
//  Validation — validateBeamOverrideCompatibility
// ═══════════════════════════════════════════════════════════════════════
section('Validation — beam/frame-override compatibility');

function makeLineWithOverride({ defaultSpec, overrideSpec, localFrameIndex = 1, beamSpec, holeIndices = [5] }) {
  resetIdCounter();
  const beam = beamSpec ?? makeBeamSpec();
  const bayBeamSpec = makeBeamSpec({ lengthIn: 96 });
  const levels = holeIndices.map((hi, i) =>
    createBeamLevel({ id: `lvl${i}`, levelIndex: i, holeIndex: hi, beamSpec: beam }),
  );
  const bays = [
    createBay({ id: 'bay0', leftFrameIndex: 0, beamSpec: bayBeamSpec, levels }),
    createBay({ id: 'bay1', leftFrameIndex: 1, beamSpec: bayBeamSpec, levels }),
  ];
  const frameOverrides = overrideSpec ? { [localFrameIndex]: overrideSpec } : {};
  const mod = createRackModule({
    id: 'mod0', frameSpec: defaultSpec, frameOverrides, bays, levelUnion: levels,
    startFrameIndex: 0, rowIndex: null,
  });
  return createRackLine({ id: 'line0', modules: [mod], rowConfiguration: RowConfiguration.SINGLE, levelMode: LevelMode.UNIFORM, backToBackConfig: null });
}

{
  // Compatible with both default and override → no override errors
  const defaultSpec = makeFrameSpec({ id: 'FRM-DEF', uprightSeries: 'T-BOLT', capacityClass: 'STANDARD', compatibleConnectorTypes: ['T-BOLT'] });
  const overrideSpec = makeFrameSpec({ id: 'FRM-OVR', uprightSeries: 'T-BOLT', capacityClass: 'STANDARD', compatibleConnectorTypes: ['T-BOLT'], heightIn: 192 });
  const beam = makeBeamSpec({ compatibleUprightSeries: ['T-BOLT'], connectorType: 'T-BOLT', capacityClass: 'STANDARD' });
  const line = makeLineWithOverride({ defaultSpec, overrideSpec, beamSpec: beam });
  const result = validateRackLine(line);
  const overrideCodes = result.errors.filter((e) => e.code.endsWith('_OVERRIDE'));
  assert(overrideCodes.length === 0, 'Override compat: no errors when beam compatible with both default and override');
}

{
  // Override has different uprightSeries — beam incompatible with override
  const defaultSpec = makeFrameSpec({ id: 'FRM-DEF', uprightSeries: 'T-BOLT', compatibleConnectorTypes: ['T-BOLT'] });
  const overrideSpec = makeFrameSpec({ id: 'FRM-TEAR', uprightSeries: 'TEARDROP', compatibleConnectorTypes: ['TEARDROP'] });
  const beam = makeBeamSpec({ compatibleUprightSeries: ['T-BOLT'], connectorType: 'T-BOLT' });
  const line = makeLineWithOverride({ defaultSpec, overrideSpec, beamSpec: beam });
  const result = validateRackLine(line);
  const seriesErr = result.errors.find((e) => e.code === 'BEAM_INCOMPATIBLE_WITH_FRAME_OVERRIDE');
  assert(seriesErr != null, 'Override compat: BEAM_INCOMPATIBLE_WITH_FRAME_OVERRIDE when upright series clashes');
  assertEqual(seriesErr.context.localFrameIndex, 1, 'Override compat: localFrameIndex in error context');
}

{
  // Override has different connector type — connector mismatch with override
  const defaultSpec = makeFrameSpec({ id: 'FRM-DEF', uprightSeries: 'T-BOLT', compatibleConnectorTypes: ['T-BOLT'] });
  const overrideSpec = makeFrameSpec({ id: 'FRM-CLIP', uprightSeries: 'T-BOLT', compatibleConnectorTypes: ['CLIP-IN'] });
  const beam = makeBeamSpec({ compatibleUprightSeries: ['T-BOLT'], connectorType: 'T-BOLT' });
  const line = makeLineWithOverride({ defaultSpec, overrideSpec, beamSpec: beam });
  const result = validateRackLine(line);
  const connErr = result.errors.find((e) => e.code === 'CONNECTOR_TYPE_MISMATCH_OVERRIDE');
  assert(connErr != null, 'Override compat: CONNECTOR_TYPE_MISMATCH_OVERRIDE when connector type clashes');
}

{
  // Override has lower capacity class — beam capacity exceeds override
  const defaultSpec = makeFrameSpec({ id: 'FRM-HEAVY', capacityClass: 'HEAVY', uprightSeries: 'T-BOLT', compatibleConnectorTypes: ['T-BOLT'] });
  const overrideSpec = makeFrameSpec({ id: 'FRM-STD', capacityClass: 'STANDARD', uprightSeries: 'T-BOLT', compatibleConnectorTypes: ['T-BOLT'] });
  const beam = makeBeamSpec({ capacityClass: 'HEAVY', compatibleUprightSeries: ['T-BOLT'], connectorType: 'T-BOLT' });
  const line = makeLineWithOverride({ defaultSpec, overrideSpec, beamSpec: beam });
  const result = validateRackLine(line);
  const capErr = result.errors.find((e) => e.code === 'CAPACITY_CLASS_EXCEEDED_OVERRIDE');
  assert(capErr != null, 'Override compat: CAPACITY_CLASS_EXCEEDED_OVERRIDE when beam capacity exceeds override');
  assertEqual(capErr.context.frameCapacityClass, 'STANDARD', 'Override compat: override capacity class in context');
}

{
  // Override is shorter than default — level exceeds override height
  const defaultSpec = makeFrameSpec({ id: 'FRM-TALL', heightIn: 240, minimumTopClearanceIn: 6, uprightSeries: 'T-BOLT', compatibleConnectorTypes: ['T-BOLT'] });
  const overrideSpec = makeFrameSpec({ id: 'FRM-SHORT', heightIn: 96, minimumTopClearanceIn: 6, uprightSeries: 'T-BOLT', compatibleConnectorTypes: ['T-BOLT'] });
  const beam = makeBeamSpec({ compatibleUprightSeries: ['T-BOLT'], connectorType: 'T-BOLT' });
  // holeIndex 50 fits in 240" frame but not in 96" frame (maxHole ~= 96/3 = ~32 minus clearance)
  const line = makeLineWithOverride({ defaultSpec, overrideSpec, beamSpec: beam, holeIndices: [50] });
  const result = validateRackLine(line);
  const heightErr = result.errors.find((e) => e.code === 'FRAME_HEIGHT_EXCEEDED_OVERRIDE');
  assert(heightErr != null, 'Override compat: FRAME_HEIGHT_EXCEEDED_OVERRIDE when level exceeds override frame height');
  assertEqual(heightErr.context.localFrameIndex, 1, 'Override compat: localFrameIndex in height error context');
}

{
  // Override same spec as default → no duplicate errors
  const defaultSpec = makeFrameSpec({ id: 'FRM-SAME' });
  const line = makeLineWithOverride({ defaultSpec, overrideSpec: defaultSpec });
  const result = validateRackLine(line);
  const overrideCodes = result.errors.filter((e) => e.code.endsWith('_OVERRIDE'));
  assert(overrideCodes.length === 0, 'Override compat: no override errors when override spec === default spec');
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
