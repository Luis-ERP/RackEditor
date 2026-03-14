import {
  ANCHORS_PER_FRAME,
  BEAMS_PER_LEVEL,
  BasePlateType,
  SAFETY_PINS_PER_BEAM,
} from '../rack/constants.js';

const CAD_QUOTE_CATALOG_VERSION = 'rack-catalog-lists-v1';

function buildQuoteNumberSeed(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const hours = `${date.getUTCHours()}`.padStart(2, '0');
  const minutes = `${date.getUTCMinutes()}`.padStart(2, '0');

  return `QTE-CAD-${year}${month}${day}-${hours}${minutes}`;
}

function getActiveRackModules(layoutStore, rackDomainRef) {
  const snapshot = layoutStore?.snapshot ? layoutStore.snapshot() : [];
  const domainMap = rackDomainRef?.current;

  if (!domainMap || typeof domainMap.get !== 'function') {
    return [];
  }

  const domainIds = new Set();
  for (const entity of snapshot) {
    if ((entity.type === 'RACK_MODULE' || entity.type === 'RACK_LINE') && entity.domainId) {
      domainIds.add(entity.domainId);
    }
  }

  return [...domainIds]
    .map((domainId) => domainMap.get(domainId))
    .filter(Boolean);
}

export function buildCadBomSnapshot(layoutStore, rackDomainRef, catalogVersion = CAD_QUOTE_CATALOG_VERSION) {
  const modules = getActiveRackModules(layoutStore, rackDomainRef);
  const merged = new Map();

  const addItem = ({ sku, name, quantity, unit = 'ea', rule }) => {
    if (!sku || !Number.isFinite(quantity) || quantity <= 0) return;

    const existing = merged.get(sku);
    if (existing) {
      existing.quantity += quantity;
      return;
    }

    merged.set(sku, {
      sku,
      name,
      quantity,
      unit,
      rule,
    });
  };

  for (const mod of modules) {
    const frameSpec = mod.frameSpec;
    const frameCount = mod.frameCount || ((mod.bays?.length ?? 0) + 1);
    addItem({
      sku: frameSpec.id,
      name: `Frame ${frameSpec.heightIn}" × ${frameSpec.depthIn}" (${frameSpec.uprightSeries})`,
      quantity: frameCount,
      rule: `frame_count=${frameCount}`,
    });

    let totalBeams = 0;
    for (const bay of mod.bays ?? []) {
      for (const level of bay.levels ?? []) {
        const beamSpec = level.beamSpec;
        addItem({
          sku: beamSpec.id,
          name: `Beam ${beamSpec.lengthIn}" (${beamSpec.beamSeries})`,
          quantity: BEAMS_PER_LEVEL,
          rule: `level_index=${level.levelIndex} × beams_per_level=${BEAMS_PER_LEVEL}`,
        });
        totalBeams += BEAMS_PER_LEVEL;
      }
    }

    addItem({
      sku: 'ACC-SAFETY-PIN',
      name: 'Safety Pin',
      quantity: totalBeams * SAFETY_PINS_PER_BEAM,
      rule: `total_beams=${totalBeams} × safety_pins_per_beam=${SAFETY_PINS_PER_BEAM}`,
    });

    const basePlateType = frameSpec.basePlateType || BasePlateType.STANDARD;
    const anchorsPerFrame = ANCHORS_PER_FRAME[basePlateType] || 2;
    addItem({
      sku: `ACC-ANCHOR-${basePlateType}`,
      name: `Anchor (${basePlateType.charAt(0) + basePlateType.slice(1).toLowerCase()})`,
      quantity: frameCount * anchorsPerFrame,
      rule: `frame_count=${frameCount} × anchors_per_frame=${anchorsPerFrame}`,
    });
  }

  return {
    items: [...merged.values()],
    catalogVersion,
    generatedAt: new Date().toISOString(),
  };
}

export function buildCadToQuotePayload({
  layoutStore,
  rackDomainRef,
  projectDocument,
}) {
  const exportedAt = new Date().toISOString();
  const designRevisionId = `cad-revision-${exportedAt}`;
  const bomSnapshot = buildCadBomSnapshot(layoutStore, rackDomainRef);

  return {
    source: 'CAD_EDITOR',
    exportedAt,
    designId: 'cad-live-design',
    designRevisionId,
    quoteNumber: buildQuoteNumberSeed(new Date(exportedAt)),
    bomSnapshot,
    projectDocument,
    stats: {
      lineCount: bomSnapshot.items.length,
      totalQuantity: bomSnapshot.items.reduce((sum, item) => sum + item.quantity, 0),
    },
  };
}

export { CAD_QUOTE_CATALOG_VERSION };