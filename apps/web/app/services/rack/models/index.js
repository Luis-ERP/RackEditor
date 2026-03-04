// ─────────────────────────────────────────────────────────────────────────────
//  Models — Barrel Export
// ─────────────────────────────────────────────────────────────────────────────

export {
  createFrameSpec,
  createFrame,
  frameHoleCount,
  maxHoleIndex,
  holeIndexToElevation,
  elevationToHoleIndex,
  frameCountFromBays,
} from './frame.js';

export {
  createBeamSpec,
  createBeamLevel,
  minimumGapSteps,
  validateLevelSpacing,
  isBeamCompatibleWithFrame,
} from './beam.js';

export {
  createBay,
  validateBayBeamLength,
  bayBeamCount,
} from './bay.js';

export {
  createRackModule,
  moduleBayCount,
  moduleFrameIndices,
} from './rackModule.js';

export {
  createRackLine,
  rackLineFrameIndices,
  rackLineAllBays,
  rackLineRowCount,
  withValidationState,
} from './rackLine.js';

export {
  createAccessorySpec,
  createAccessory,
} from './accessory.js';

export {
  createDesignRevision,
  deriveRevision,
} from './designRevision.js';
