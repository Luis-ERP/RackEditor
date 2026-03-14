// ─────────────────────────────────────────────────────────────────────────────
//  Rack Domain — Public API
//
//  Barrel export for the entire rack configuration domain layer.
//  Provides models, factories, validation, BOM, accessories, and pricing.
//
//  No CAD/position/orientation attributes are included in this layer.
//  All geometry is derived from semantic configuration data. (Section 18)
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants & Enums ───────────────────────────────────────────────────────
export {
  HOLE_STEP_IN,
  MIN_BAY_COUNT,
  SAFETY_PINS_PER_BEAM,
  BEAMS_PER_LEVEL,
  ValidationState,
  RowConfiguration,
  LevelMode,
  AccessoryScope,
  AccessoryCategory,
  BasePlateType,
  ANCHORS_PER_FRAME,
  CAPACITY_CLASS_RANK,
} from './constants.js';

// ── Models ──────────────────────────────────────────────────────────────────
export {
  // Frame
  createFrameSpec,
  createFrame,
  frameHoleCount,
  maxHoleIndex,
  holeIndexToElevation,
  elevationToHoleIndex,
  frameCountFromBays,

  // Beam
  createBeamSpec,
  createBeamLevel,
  minimumGapSteps,
  validateLevelSpacing,
  isBeamCompatibleWithFrame,

  // Bay
  createBay,
  validateBayBeamLength,
  bayBeamCount,

  // Module
  createRackModule,
  moduleBayCount,
  moduleFrameIndices,

  // Rack Line
  createRackLine,
  rackLineFrameIndices,
  rackLineAllBays,
  rackLineRowCount,
  withValidationState,

  // Accessory
  createAccessorySpec,
  createAccessory,

  // Design Revision
  createDesignRevision,
  deriveRevision,
} from './models/index.js';

// ── Factory / Builders ──────────────────────────────────────────────────────
export {
  resetIdCounter,
  buildBeamLevels,
  buildRackModule,
  buildRackLine,
  buildSimpleRackLine,
  buildMultiModuleRackLine,
  generateFrames,
} from './rackFactory.js';

// ── Validation ──────────────────────────────────────────────────────────────
export {
  validateRackLine,
  validateDesignRevision,
} from './validation.js';

// ── BOM ─────────────────────────────────────────────────────────────────────
export {
  deriveRackLineBOM,
  deriveDesignRevisionBOM,
} from './bomService.js';

// ── Accessories ─────────────────────────────────────────────────────────────
export {
  DERIVED_SPECS,
  resetAccessoryIdCounter,
  derivedAccessories,
  mergeAccessories,
  computeAllAccessories,
} from './accessoryService.js';

// ── Pricing ─────────────────────────────────────────────────────────────────
export {
  computePricing,
} from './pricingService.js';
