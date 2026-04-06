// ─────────────────────────────────────────────────────────────────────────────
//  CAD Import Service
//
//  Parses a RackEditor CAD project JSON file (example-cad-project.json format)
//  and derives a BOM snapshot compatible with withSyncedCadBom.
//
//  The JSON structure expected:
//    {
//      documentType: "rack-editor-project",
//      semantics: {
//        rackDomain: {
//          modules: [ { id, frameSpec, bays, frameCount, rowIndex, ... } ]
//        }
//      }
//    }
//
//  Catalog lookup uses BEAMS_CSV and FRAMES_CSV from catalogData.js to resolve
//  costs and weights by matching spec dimensions.
// ─────────────────────────────────────────────────────────────────────────────

import { BEAMS_CSV, FRAMES_CSV } from '@/src/core/rack/catalog_lists/catalogData.js';

export const CAD_IMPORT_SESSION_KEY = 'quoter:pendingCadImport';

const BEAMS_PER_LEVEL = 2;
const SAFETY_PINS_PER_BEAM = 2;
const ANCHORS_PER_FRAME = 2;

// ── Catalog lookup helpers ────────────────────────────────────────────────────

/**
 * Find the best matching catalog entry for a frame spec.
 * Matches by height_in, depth_in, and gauge.
 *
 * @param {{ heightIn: number, depthIn: number, gauge: string }} frameSpec
 * @returns {{ cost: number, weight_kg: number, sku: string }|null}
 */
function resolveFrameCatalogEntry(frameSpec) {
  const heightIn = Number(frameSpec.heightIn);
  const depthIn = Number(frameSpec.depthIn);
  const gauge = parseInt(String(frameSpec.gauge), 10);

  // Exact match first
  let match = FRAMES_CSV.find(
    (r) => r.height_in === heightIn && r.depth_in === depthIn && r.gauge === gauge,
  );

  // Fall back to height+depth only
  if (!match) {
    match = FRAMES_CSV.find((r) => r.height_in === heightIn && r.depth_in === depthIn);
  }

  if (!match) return null;
  return {
    cost: match.cost,
    weight_kg: match.weight_kg,
    sku: match.sku,
    gauge: match.gauge,
    load_capacity_kg: match.load_capacity_kg,
  };
}

/**
 * Find the best matching catalog entry for a beam spec.
 * Matches by lengthIn (→ width_in) and profileHeightIn (→ height_in).
 *
 * @param {{ lengthIn: number, profileHeightIn?: number, verticalEnvelopeIn?: number }} beamSpec
 * @returns {{ cost: number, weight_kg: number, sku: string }|null}
 */
function resolveBeamCatalogEntry(beamSpec) {
  const lengthIn = Number(beamSpec.lengthIn);
  const profileHeightIn = Number(beamSpec.profileHeightIn ?? beamSpec.verticalEnvelopeIn ?? 0);

  let match = BEAMS_CSV.find(
    (r) => r.width_in === lengthIn && r.height_in === profileHeightIn,
  );

  if (!match) {
    match = BEAMS_CSV.find((r) => r.width_in === lengthIn);
  }

  if (!match) return null;
  return {
    cost: match.price,
    weight_kg: match.weight_kg,
    sku: match.sku,
    gauge: match.gauge,
    load_capacity_kg: match.load_capacity_kg,
    width_in: match.width_in,
    height_in: match.height_in,
  };
}

// ── Row count from rowConfiguration ──────────────────────────────────────────

function rowCountFromConfig(rowConfiguration) {
  if (!rowConfiguration) return 1;
  const m = String(rowConfiguration).match(/BACK_TO_BACK_(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 1;
}

// ── Main BOM derivation ───────────────────────────────────────────────────────

/**
 * Derive a BOM snapshot from a parsed CAD project JSON object.
 *
 * @param {Object} cadProject - Parsed JSON (documentType: "rack-editor-project")
 * @returns {{ items: Array, catalogVersion: string, generatedAt: string }}
 */
export function deriveBomFromCadProject(cadProject) {
  if (!cadProject || cadProject.documentType !== 'rack-editor-project') {
    throw new Error('Invalid CAD project file. Expected documentType: "rack-editor-project".');
  }

  const modules = cadProject?.semantics?.rackDomain?.modules;
  if (!Array.isArray(modules) || modules.length === 0) {
    return {
      items: [],
      catalogVersion: 'unknown',
      generatedAt: new Date().toISOString(),
    };
  }

  // Build a map from entity domainId → rowConfiguration (for row count)
  const entityRowConfigMap = {};
  const entities = cadProject?.layout?.entities ?? [];
  for (const entity of entities) {
    if (entity.type === 'RACK_MODULE' && entity.domainId) {
      entityRowConfigMap[entity.domainId] = entity.rowConfiguration ?? 'SINGLE';
    }
  }

  // Aggregate: frameSpecId → { spec, count, catalogEntry }
  const frameMap = new Map();
  // Aggregate: beamSpecId → { spec, count, catalogEntry }
  const beamMap = new Map();
  let totalBeams = 0;

  for (const mod of modules) {
    // Only count front-row modules for frames (rowIndex 0) to avoid double-counting
    // in back-to-back configurations where physical frames are shared.
    const rowIndex = Number(mod.rowIndex ?? 0);
    const frameCount = Number(mod.frameCount ?? (mod.bays?.length ?? 0) + 1);

    // Determine row count from the entity that owns this module
    const rowConfig = entityRowConfigMap[mod.id] ?? 'SINGLE';
    const rowCount = rowCountFromConfig(rowConfig);

    if (rowIndex === 0) {
      // Frames: physical frames shared across rows
      const frameSpec = mod.frameSpec;
      if (frameSpec) {
        const specId = frameSpec.id;
        const existing = frameMap.get(specId) ?? {
          spec: frameSpec,
          count: 0,
          catalogEntry: resolveFrameCatalogEntry(frameSpec),
        };
        existing.count += frameCount;
        frameMap.set(specId, existing);
      }
    }

    // Beams: each row has its own beams (2 per level per bay)
    for (const bay of (mod.bays ?? [])) {
      for (const level of (bay.levels ?? [])) {
        const beamSpec = level.beamSpec ?? bay.beamSpec;
        if (!beamSpec) continue;
        const specId = beamSpec.id;
        const existing = beamMap.get(specId) ?? {
          spec: beamSpec,
          count: 0,
          catalogEntry: resolveBeamCatalogEntry(beamSpec),
        };
        existing.count += BEAMS_PER_LEVEL;
        beamMap.set(specId, existing);
      }
    }
    totalBeams += (mod.bays ?? []).reduce((s, bay) => s + (bay.levels?.length ?? 0), 0) * BEAMS_PER_LEVEL;
  }

  const items = [];

  // ── Frames ────────────────────────────────────────────────────
  for (const [specId, { spec, count, catalogEntry }] of frameMap) {
    const sku = catalogEntry?.sku ?? specId;
    const cost = catalogEntry?.cost ?? 0;
    const weight_kg = catalogEntry?.weight_kg ?? 0;
    const gauge = catalogEntry?.gauge ?? spec.gauge ?? '—';
    const load_capacity_kg = catalogEntry?.load_capacity_kg ?? '—';
    const name = `Frame ${spec.heightIn}"h × ${spec.depthIn}"d (${spec.uprightSeries ?? 'std'})`;
    // Format: width x height x depth | gauge | load capacity | weight
    // Frames are uprights: height × depth (no separate width dimension)
    const description = `${spec.heightIn}" × ${spec.depthIn}" | ${gauge}ga | ${load_capacity_kg} kg | ${weight_kg} kg`;
    items.push({
      sku,
      name,
      description,
      quantity: count,
      unit: 'ea',
      rule: 'frame_count',
      _catalogCost: cost,
      _catalogWeight: weight_kg,
      _dims: {
        widthDepth: `${spec.depthIn}"`,
        height: `${spec.heightIn}"`,
        gauge: gauge !== '—' ? `${gauge}ga` : '—',
        loadCapacity: load_capacity_kg !== '—' ? `${load_capacity_kg} kg` : '—',
        weight: `${weight_kg} kg`,
      },
    });
  }

  // ── Beams ─────────────────────────────────────────────────────
  for (const [specId, { spec, count, catalogEntry }] of beamMap) {
    const sku = catalogEntry?.sku ?? specId;
    const cost = catalogEntry?.cost ?? 0;
    const weight_kg = catalogEntry?.weight_kg ?? 0;
    const gauge = catalogEntry?.gauge ?? '—';
    const load_capacity_kg = catalogEntry?.load_capacity_kg ?? '—';
    const widthIn = catalogEntry?.width_in ?? spec.lengthIn;
    const heightIn = catalogEntry?.height_in ?? spec.profileHeightIn ?? spec.verticalEnvelopeIn ?? '—';
    const name = `Beam ${spec.lengthIn}" (${spec.beamSeries ?? 'std'})`;
    // Format: width x height x depth | gauge | load capacity | weight
    const description = `${widthIn}" × ${heightIn}" | ${gauge}ga | ${load_capacity_kg} kg | ${weight_kg} kg`;
    items.push({
      sku,
      name,
      description,
      quantity: count,
      unit: 'ea',
      rule: `bay_count × levels × ${BEAMS_PER_LEVEL}`,
      _catalogCost: cost,
      _catalogWeight: weight_kg,
      _dims: {
        widthDepth: `${widthIn}"`,
        height: `${heightIn}"`,
        gauge: gauge !== '—' ? `${gauge}ga` : '—',
        loadCapacity: load_capacity_kg !== '—' ? `${load_capacity_kg} kg` : '—',
        weight: `${weight_kg} kg`,
      },
    });
  }

  // ── Safety Pins ───────────────────────────────────────────────
  if (totalBeams > 0) {
    items.push({
      sku: 'ACC-SAFETY-PIN',
      name: 'Safety Pin',
      description: 'Accessory | — | — | —',
      quantity: totalBeams * SAFETY_PINS_PER_BEAM,
      unit: 'ea',
      rule: `total_beams=${totalBeams} × ${SAFETY_PINS_PER_BEAM}`,
      _catalogCost: 0,
      _catalogWeight: 0,
      _dims: { widthDepth: '—', height: '—', gauge: '—', loadCapacity: '—', weight: '—' },
    });
  }

  // ── Anchors ───────────────────────────────────────────────────
  const totalPhysicalFrames = [...frameMap.values()].reduce((s, { count }) => s + count, 0);
  if (totalPhysicalFrames > 0) {
    items.push({
      sku: 'ACC-ANCHOR-STANDARD',
      name: 'Anchor (STANDARD)',
      description: 'Accessory | — | — | —',
      quantity: totalPhysicalFrames * ANCHORS_PER_FRAME,
      unit: 'ea',
      rule: `frames=${totalPhysicalFrames} × ${ANCHORS_PER_FRAME}`,
      _catalogCost: 0,
      _catalogWeight: 0,
      _dims: { widthDepth: '—', height: '—', gauge: '—', loadCapacity: '—', weight: '—' },
    });
  }

  return {
    items,
    catalogVersion: cadProject.app?.version ?? 'web-v1',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Parse a CAD project JSON string and derive a BOM snapshot.
 *
 * @param {string} jsonString
 * @returns {{ bom: Object, projectFile: string, error?: string }}
 */
export function importCadProjectJson(jsonString) {
  let cadProject;
  try {
    cadProject = JSON.parse(jsonString);
  } catch {
    return { bom: null, projectFile: '', error: 'Invalid JSON file.' };
  }

  try {
    const bom = deriveBomFromCadProject(cadProject);
    return { bom, projectFile: cadProject.exportedAt ?? '', error: null };
  } catch (err) {
    return { bom: null, projectFile: '', error: err.message };
  }
}

function resolveSessionStorage(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read a pending CAD import payload from session storage.
 * This bridge keeps transport details outside Quoter UI logic.
 *
 * @param {Storage|null|undefined} storage
 * @returns {{ raw: string, source: string }|null}
 */
export function readPendingCadImportFromSession(storage) {
  const target = resolveSessionStorage(storage);
  if (!target) return null;

  let raw = null;
  try {
    raw = target.getItem(CAD_IMPORT_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  return {
    raw,
    source: 'CAD Editor',
  };
}

/**
 * Clear the pending CAD import payload from session storage.
 *
 * @param {Storage|null|undefined} storage
 */
export function clearPendingCadImportFromSession(storage) {
  const target = resolveSessionStorage(storage);
  if (!target) return;
  try {
    target.removeItem(CAD_IMPORT_SESSION_KEY);
  } catch {
    // Ignore session storage errors in restricted browser contexts.
  }
}

/**
 * Build a resolveCatalog function for use with withSyncedCadBom.
 * The BOM items carry _catalogCost and _catalogWeight from deriveBomFromCadProject.
 *
 * @param {Array} bomItems
 * @returns {(sku: string, bomLine: Object) => { cost: number, weight_kg: number }}
 */
export function buildCatalogResolver(bomItems) {
  const bySkuMap = new Map(
    bomItems.map((item) => [item.sku, { cost: item._catalogCost ?? 0, weight_kg: item._catalogWeight ?? 0 }]),
  );
  return (sku) => bySkuMap.get(sku) ?? { cost: 0, weight_kg: 0 };
}
