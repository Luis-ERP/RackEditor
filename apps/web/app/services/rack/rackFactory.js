// ─────────────────────────────────────────────────────────────────────────────
//  Rack Factory Service
//
//  High-level factory for assembling rack modules and rack lines from
//  configuration parameters. Enforces all structural constraints and
//  provides convenience builders.
//
//  Reference: business_rules_racks.md — Sections 2, 9, 11, 12, 13
// ─────────────────────────────────────────────────────────────────────────────

import {
  RowConfiguration,
  LevelMode,
  HOLE_STEP_IN,
  MIN_BAY_COUNT,
} from './constants.js';

import { createFrame, createFrameSpec, frameCountFromBays } from './models/frame.js';
import { createBeamLevel, isBeamCompatibleWithFrame }        from './models/beam.js';
import { createBay }                                          from './models/bay.js';
import { createRackModule, resolveFrameSpecAtIndex }          from './models/rackModule.js';
import { createRackLine }                                     from './models/rackLine.js';
import { validateRackLine }                                   from './validation.js';
import { withValidationState }                                from './models/rackLine.js';

let _idCounter = 0;
function nextId(prefix = 'id') {
  return `${prefix}_${++_idCounter}`;
}

/**
 * Reset the internal ID counter. Useful for testing.
 */
export function resetIdCounter() {
  _idCounter = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Beam Level Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an array of beam levels from a list of hole indices and a beam spec.
 *
 * @param {number[]} holeIndices - Array of hole positions (must be integers, ascending)
 * @param {import('./models/beam.js').BeamSpec} beamSpec
 * @returns {import('./models/beam.js').BeamLevel[]}
 */
export function buildBeamLevels(holeIndices, beamSpec) {
  if (!Array.isArray(holeIndices) || holeIndices.length === 0) {
    throw new Error('holeIndices must be a non-empty array.');
  }

  const sorted = [...holeIndices].sort((a, b) => a - b);
  return sorted.map((holeIndex, i) =>
    createBeamLevel({
      id: nextId('lvl'),
      levelIndex: i,
      holeIndex,
      beamSpec,
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Module Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ModuleConfig
 * @property {import('./models/frame.js').FrameSpec} frameSpec
 * @property {import('./models/beam.js').BeamSpec}   beamSpec
 * @property {number}        bayCount            - Number of bays in the module (≥ 1)
 * @property {number[]}      holeIndices         - Beam level hole indices (shared across all bays)
 * @property {number}        [startFrameIndex=0] - Starting frame position in parent line
 * @property {number|null}   [rowIndex=null]     - Row membership for back-to-back configurations (Section 9.2.2)
 */

/**
 * Build a complete rack module from configuration.
 *
 * Creates all bays with uniform beam levels. Each bay references its
 * left/right frame indices and inherits the module's beam spec and levels.
 *
 * @param {ModuleConfig} config
 * @returns {import('./models/rackModule.js').RackModule}
 */
export function buildRackModule(config) {
  const {
    frameSpec,
    beamSpec,
    bayCount,
    holeIndices,
    startFrameIndex = 0,
    rowIndex = null,
  } = config;

  if (bayCount < MIN_BAY_COUNT) {
    throw new RangeError(`bayCount must be at least ${MIN_BAY_COUNT}.`);
  }

  // Section 12: Beam must be compatible with frame
  if (!isBeamCompatibleWithFrame(beamSpec, frameSpec.uprightSeries)) {
    throw new Error(
      `Beam "${beamSpec.id}" is not compatible with frame upright series "${frameSpec.uprightSeries}".`
    );
  }

  // Build shared beam levels
  const levelUnion = buildBeamLevels(holeIndices, beamSpec);

  // Build bays
  const bays = [];
  for (let i = 0; i < bayCount; i++) {
    const leftFrameIndex = startFrameIndex + i;
    bays.push(
      createBay({
        id: nextId('bay'),
        leftFrameIndex,
        beamSpec,
        levels: levelUnion,
      })
    );
  }

  return createRackModule({
    id: nextId('mod'),
    frameSpec,
    bays,
    levelUnion,
    startFrameIndex,
    rowIndex,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Rack Line Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RackLineConfig
 * @property {ModuleConfig[]}       moduleConfigs     - Config for each module
 * @property {string}               [rowConfiguration='SINGLE']
 * @property {string}               [levelMode='UNIFORM']
 * @property {import('./models/rackLine.js').BackToBackConfig|null} [backToBackConfig=null]
 */

/**
 * Build a complete rack line from module configurations.
 *
 * Validates the pattern rules (Section 9):
 *   - Each module must have ≥ 1 bay
 *   - Consecutive modules share an adjacent frame
 *   - The line starts and ends with a frame
 *
 * Automatically validates the resulting line and stamps the validation state.
 *
 * @param {RackLineConfig} config
 * @param {Object} [validationOptions]
 * @returns {import('./models/rackLine.js').RackLine}
 */
export function buildRackLine(config, validationOptions = {}) {
  const {
    moduleConfigs,
    rowConfiguration = RowConfiguration.SINGLE,
    levelMode = LevelMode.UNIFORM,
    backToBackConfig = null,
  } = config;

  if (!Array.isArray(moduleConfigs) || moduleConfigs.length === 0) {
    throw new Error('A rack line requires at least one module configuration.');
  }

  // Build modules with consecutive frame indices
  const modules = [];
  let currentFrameIndex = 0;

  for (let i = 0; i < moduleConfigs.length; i++) {
    const mc = moduleConfigs[i];
    const mod = buildRackModule({
      ...mc,
      startFrameIndex: currentFrameIndex,
    });

    modules.push(mod);

    // Next module starts at this module's end frame (shared frame)
    currentFrameIndex = mod.endFrameIndex;
  }

  // Create the rack line
  let line = createRackLine({
    id: nextId('line'),
    modules,
    rowConfiguration,
    levelMode,
    backToBackConfig,
  });

  // Auto-validate and stamp state
  const result = validateRackLine(line, validationOptions);
  line = withValidationState(line, result.state);

  return line;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shortcut: Simple Uniform Rack Line
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a simple rack line with a single module, uniform beam levels,
 * and identical beam specs across all bays.
 *
 * This is the most common configuration for selective pallet racking.
 *
 * @param {Object} params
 * @param {import('./models/frame.js').FrameSpec} params.frameSpec
 * @param {import('./models/beam.js').BeamSpec}   params.beamSpec
 * @param {number}   params.bayCount
 * @param {number[]} params.holeIndices
 * @param {string}   [params.rowConfiguration='SINGLE']
 * @param {import('./models/rackLine.js').BackToBackConfig|null} [params.backToBackConfig=null]
 * @param {Object}   [params.validationOptions={}]
 * @returns {import('./models/rackLine.js').RackLine}
 */
export function buildSimpleRackLine({
  frameSpec,
  beamSpec,
  bayCount,
  holeIndices,
  rowConfiguration = RowConfiguration.SINGLE,
  backToBackConfig = null,
  validationOptions = {},
}) {
  return buildRackLine(
    {
      moduleConfigs: [{
        frameSpec,
        beamSpec,
        bayCount,
        holeIndices,
      }],
      rowConfiguration,
      levelMode: LevelMode.UNIFORM,
      backToBackConfig,
    },
    validationOptions,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Multi-Module Rack Line
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a rack line with multiple modules that may have different frame/beam
 * specs or bay counts, but share adjacent frames.
 *
 * Example: |=|=| |=| → two modules, first has 2 bays, second has 1 bay.
 * Note: The space in the symbol notation indicates different modules (potentially
 * different configurations), NOT a gap. They still share the adjacent frame.
 *
 * @param {Object} params
 * @param {ModuleConfig[]} params.moduleConfigs
 * @param {string}         [params.rowConfiguration='SINGLE']
 * @param {import('./models/rackLine.js').BackToBackConfig|null} [params.backToBackConfig=null]
 * @param {Object}         [params.validationOptions={}]
 * @returns {import('./models/rackLine.js').RackLine}
 */
export function buildMultiModuleRackLine({
  moduleConfigs,
  rowConfiguration = RowConfiguration.SINGLE,
  backToBackConfig = null,
  validationOptions = {},
}) {
  return buildRackLine(
    {
      moduleConfigs,
      rowConfiguration,
      levelMode: LevelMode.VARIABLE,
      backToBackConfig,
    },
    validationOptions,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Frame Instance Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate all frame instances for a rack line from its modules.
 * Shared frames between modules are de-duplicated (one frame instance
 * per unique position index).
 *
 * @param {import('./models/rackLine.js').RackLine} rackLine
 * @returns {import('./models/frame.js').Frame[]}
 */
export function generateFrames(rackLine) {
  const frameMap = new Map(); // positionIndex → Frame

  for (const mod of rackLine.modules) {
    for (let localIdx = 0; localIdx <= mod.bays.length; localIdx++) {
      const absoluteIdx = mod.startFrameIndex + localIdx;
      if (!frameMap.has(absoluteIdx)) {
        const effectiveSpec = resolveFrameSpecAtIndex(mod, localIdx);
        frameMap.set(absoluteIdx, createFrame({
          id:            nextId('frm'),
          spec:          effectiveSpec,
          positionIndex: absoluteIdx,
          isCustomSpec:  effectiveSpec !== mod.frameSpec,
          rowIndex:      mod.rowIndex,
        }));
      }
    }
  }

  return [...frameMap.values()].sort((a, b) => a.positionIndex - b.positionIndex);
}
