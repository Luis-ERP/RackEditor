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
  withBeamLevelSpec,
} from './beam.js';

export {
  createBay,
  validateBayBeamLength,
  bayBeamCount,
  withBayBeamSpec,
} from './bay.js';

export {
  createRackModule,
  moduleBayCount,
  moduleFrameIndices,
  resolveFrameSpecAtIndex,
  withFrameOverride,
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
