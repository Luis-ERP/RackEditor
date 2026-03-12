// ─────────────────────────────────────────────────────────────────────────────
//  Rack Line (Rack Run) Model
//
//  A rack line is a continuous sequence of pallet rack bays composed of one
//  or more modules. Modules within a line must be consecutive and may share
//  adjacent frames.
//
//  A rack line may be single-row or back-to-back (2, 3, or 4 rows).
//
//  Reference: business_rules_racks.md — Sections 1, 9, 9.1, 9.2
// ─────────────────────────────────────────────────────────────────────────────

import { RowConfiguration, LevelMode, ValidationState } from '../constants.js';

/**
 * @typedef {Object} BackToBackConfig
 * @property {number}  rowSpacerSizeIn   - Spacer size between rows (inches)
 *
 * NOTE: Row count is NOT stored here. It is the single normative value derived
 * from the parent RackLine's rowConfiguration property. (Section 9.2.1)
 */

/**
 * @typedef {Object} RackLine
 * @property {string}  id                   - Unique identifier
 * @property {import('./rackModule.js').RackModule[]} modules - Ordered modules (left → right)
 * @property {string}  rowConfiguration     - RowConfiguration enum value
 * @property {string}  levelMode            - LevelMode enum value (UNIFORM | VARIABLE)
 * @property {BackToBackConfig|null} backToBackConfig - Config for back-to-back setups
 * @property {number}  totalBayCount        - Derived: sum of all module bay counts
 * @property {number}  totalFrameCount      - Derived: accounts for shared frames
 * @property {string}  validationState      - Current validation state
 * @property {string[]} accessoryIds        - IDs of accessories applied to this line
 */

/**
 * Create a rack line.
 *
 * Pattern validation (Section 9):
 *   Valid:   |=|   |=|=|   |=|=| |=|
 *   Invalid: |=    |==|    =|=    |=||=|    |    =
 *
 * Each module must start and end with a frame.
 * Consecutive modules within the SAME line must share an adjacent frame
 * (module[i].endFrameIndex === module[i+1].startFrameIndex).
 *
 * @param {Object} params
 * @param {string}  params.id
 * @param {import('./rackModule.js').RackModule[]} params.modules
 * @param {string}  [params.rowConfiguration='SINGLE']
 * @param {string}  [params.levelMode='UNIFORM']
 * @param {BackToBackConfig|null} [params.backToBackConfig=null]
 * @param {string[]} [params.accessoryIds=[]]
 * @returns {Readonly<RackLine>}
 */
export function createRackLine({
  id,
  modules,
  rowConfiguration = RowConfiguration.SINGLE,
  levelMode = LevelMode.UNIFORM,
  backToBackConfig = null,
  accessoryIds = [],
}) {
  if (!Array.isArray(modules) || modules.length < 1) {
    throw new Error('A rack line must contain at least 1 module.');
  }

  // Validate row configuration
  if (!Object.values(RowConfiguration).includes(rowConfiguration)) {
    throw new Error(`Invalid rowConfiguration: ${rowConfiguration}`);
  }

  // Back-to-back requires config
  if (rowConfiguration !== RowConfiguration.SINGLE && !backToBackConfig) {
    throw new Error('backToBackConfig is required for back-to-back configurations.');
  }

  // Validate module continuity: consecutive modules must share a frame
  for (let i = 1; i < modules.length; i++) {
    if (modules[i].startFrameIndex !== modules[i - 1].endFrameIndex) {
      throw new Error(
        `Module ${i} is not consecutive with module ${i - 1}. ` +
        `Expected startFrameIndex=${modules[i - 1].endFrameIndex}, ` +
        `got ${modules[i].startFrameIndex}.`
      );
    }
  }

  // Derive totals
  const totalBayCount = modules.reduce((sum, m) => sum + m.bays.length, 0);

  // Total frames accounts for shared frames between modules.
  // First module contributes all its frames; subsequent modules contribute (frameCount - 1)
  // because they share their first frame with the previous module's last frame.
  const totalFrameCount = modules.reduce((sum, m, idx) => {
    return sum + (idx === 0 ? m.frameCount : m.frameCount - 1);
  }, 0);

  return Object.freeze({
    id,
    modules: Object.freeze([...modules]),
    rowConfiguration,
    levelMode,
    backToBackConfig: backToBackConfig ? Object.freeze({ ...backToBackConfig }) : null,
    totalBayCount,
    totalFrameCount,
    validationState: ValidationState.INCOMPLETE,
    accessoryIds: Object.freeze([...accessoryIds]),
  });
}

/**
 * Get all distinct frame indices across all modules in a rack line.
 * Accounts for shared frames between consecutive modules.
 *
 * @param {RackLine} line
 * @returns {number[]}
 */
export function rackLineFrameIndices(line) {
  const indexSet = new Set();
  for (const mod of line.modules) {
    for (let i = mod.startFrameIndex; i <= mod.endFrameIndex; i++) {
      indexSet.add(i);
    }
  }
  return [...indexSet].sort((a, b) => a - b);
}

/**
 * Get all bays across all modules in a rack line.
 *
 * @param {RackLine} line
 * @returns {import('./bay.js').Bay[]}
 */
export function rackLineAllBays(line) {
  return line.modules.flatMap((m) => m.bays);
}

/**
 * Compute the total row count for the rack line configuration.
 *
 * @param {RackLine} line
 * @returns {number}
 */
export function rackLineRowCount(line) {
  switch (line.rowConfiguration) {
    case RowConfiguration.SINGLE:         return 1;
    case RowConfiguration.BACK_TO_BACK_2: return 2;
    case RowConfiguration.BACK_TO_BACK_3: return 3;
    case RowConfiguration.BACK_TO_BACK_4: return 4;
    default: return 1;
  }
}

/**
 * Create a RackLine with an updated validation state.
 * (Immutable — returns a new frozen object.)
 *
 * @param {RackLine} line
 * @param {string}   validationState
 * @returns {Readonly<RackLine>}
 */
export function withValidationState(line, validationState) {
  if (!Object.values(ValidationState).includes(validationState)) {
    throw new Error(`Invalid validation state: ${validationState}`);
  }
  return Object.freeze({ ...line, validationState });
}
