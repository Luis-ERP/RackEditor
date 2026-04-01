// ─────────────────────────────────────────────────────────────────────────────
//  Row Spacer Rules
//
//  Height-based heuristic for the number of row spacers required per frame pair
//  between adjacent back-to-back rows.
//
//  Rule used across editor preview + BOM:
//    up to 144 in   -> 2 spacers per frame pair
//    145 to 216 in  -> 3 spacers per frame pair
//    above 216 in   -> 4 spacers per frame pair
// ─────────────────────────────────────────────────────────────────────────────

import { resolveFrameSpecAtIndex } from './models/rackModule.js';

/**
 * Spacers required for one frame pair based on frame height.
 *
 * @param {number} heightIn
 * @returns {number}
 */
export function spacersPerFramePairForHeight(heightIn) {
  if (!Number.isFinite(heightIn) || heightIn <= 0) return 2;
  if (heightIn <= 144) return 2;
  if (heightIn <= 216) return 3;
  return 4;
}

/**
 * Total row spacers for a module, accounting for per-frame overrides.
 *
 * @param {import('./models/rackModule.js').RackModule} mod
 * @param {number} rowCount
 * @returns {number}
 */
export function rowSpacerCountForModule(mod, rowCount) {
  if (!mod || rowCount <= 1) return 0;
  let totalPerRowPair = 0;
  for (let localIdx = 0; localIdx < mod.frameCount; localIdx++) {
    const frameSpec = resolveFrameSpecAtIndex(mod, localIdx);
    totalPerRowPair += spacersPerFramePairForHeight(frameSpec.heightIn);
  }
  return totalPerRowPair * (rowCount - 1);
}

/**
 * Total row spacers for a line of modules with shared-frame de-duplication.
 *
 * @param {import('./models/rackModule.js').RackModule[]} modules
 * @param {number} rowCount
 * @returns {number}
 */
export function rowSpacerCountForModules(modules, rowCount) {
  if (!Array.isArray(modules) || modules.length === 0 || rowCount <= 1) return 0;

  const seenAbsFrameIndices = new Set();
  let totalPerRowPair = 0;

  for (const mod of modules) {
    for (let localIdx = 0; localIdx < mod.frameCount; localIdx++) {
      const absIdx = mod.startFrameIndex + localIdx;
      if (seenAbsFrameIndices.has(absIdx)) continue;
      seenAbsFrameIndices.add(absIdx);

      const frameSpec = resolveFrameSpecAtIndex(mod, localIdx);
      totalPerRowPair += spacersPerFramePairForHeight(frameSpec.heightIn);
    }
  }

  return totalPerRowPair * (rowCount - 1);
}

/**
 * Draft-level helper used by the editor UI before a domain module is committed.
 *
 * @param {{ frameSpec: {heightIn:number}, frameOverrides?: Object.<number, {heightIn:number}>, bayCount?: number }} draft
 * @returns {number}
 */
export function draftSpacersPerRowPair(draft) {
  const frameCount = Math.max(1, (draft?.bayCount ?? 1) + 1);
  const overrides = draft?.frameOverrides ?? {};
  let total = 0;
  for (let localIdx = 0; localIdx < frameCount; localIdx++) {
    const spec = overrides[localIdx] ?? draft?.frameSpec;
    total += spacersPerFramePairForHeight(spec?.heightIn ?? 144);
  }
  return total;
}
