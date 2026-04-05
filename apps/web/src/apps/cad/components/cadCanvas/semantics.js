import { resolveFrameSpecAtIndex } from '../../services/rack/models/rackModule.js';

export function roundMetric(value) {
  return Number(value.toFixed(3));
}

// ─── Spec serializers ────────────────────────────────────────────────────────

function describeFrameSpec(spec) {
  return {
    id: spec.id,
    heightIn: spec.heightIn,
    depthIn: spec.depthIn,
    gauge: spec.gauge,
    capacityClass: spec.capacityClass,
    uprightSeries: spec.uprightSeries,
    basePlateType: spec.basePlateType ?? null,
  };
}

function describeBeamSpec(spec) {
  return {
    id: spec.id,
    lengthIn: spec.lengthIn,
    capacityLbPair: spec.capacityLbPair,
    series: spec.beamSeries ?? spec.series ?? null,
  };
}

// ─── Per-component expanders ─────────────────────────────────────────────────

/**
 * Expand every frame in a RackModule to its resolved spec, flagging overrides.
 * @param {import('../../services/rack/models/rackModule.js').RackModule} mod
 */
function describeModuleFrames(mod) {
  return Array.from({ length: mod.frameCount }, (_, localIdx) => {
    const resolved = resolveFrameSpecAtIndex(mod, localIdx);
    const entry = {
      frameIndex: (mod.startFrameIndex ?? 0) + localIdx,
      spec: describeFrameSpec(resolved),
    };
    if (mod.frameOverrides?.[localIdx] != null) entry.isCustom = true;
    return entry;
  });
}

/**
 * Expand every beam level in a RackModule's levelUnion, flagging customized ones.
 * @param {import('../../services/rack/models/rackModule.js').RackModule} mod
 */
function describeModuleLevels(mod) {
  return (mod.levelUnion ?? []).map((level, i) => {
    const entry = {
      levelIndex: i,
      holeIndex: level.holeIndex,
      elevationIn: level.elevationIn,
      spec: describeBeamSpec(level.beamSpec),
    };
    if (level.isBeamSpecCustomized) entry.isCustom = true;
    return entry;
  });
}

export function describeEntitySemantics(entity, selected, rackDomainRef) {
  const base = {
    id: entity.id,
    type: entity.type,
    semanticRole: entity.type.toLowerCase(),
    label: entity.label || null,
    selected,
    visible: entity.visible,
    locked: entity.locked,
    positionM: {
      x: roundMetric(entity.transform.x),
      y: roundMetric(entity.transform.y),
    },
    rotationDeg: roundMetric(entity.transform.rotation),
  };

  switch (entity.type) {
    case 'RACK_MODULE': {
      const domain = rackDomainRef.current.get(entity.domainId);
      const firstBay = domain?.bays?.[0] ?? null;
      return {
        ...base,
        semanticRole: 'rack-module',
        domainId: entity.domainId,
        bayCount: entity.bayCount ?? domain?.bays?.length ?? null,
        widthM: roundMetric(entity.widthM),
        depthM: roundMetric(entity.depthM),
        orientation: entity.transform.rotation === 90 ? 'vertical' : 'horizontal',
        rack: domain ? {
          id: domain.id,
          frameCount: domain.frameCount,
          startFrameIndex: domain.startFrameIndex,
          endFrameIndex: domain.endFrameIndex,
          levelCount: domain.levelUnion?.length ?? null,
          rowConfiguration: null,
          levelMode: null,
          backToBackConfig: null,
          accessoryIds: firstBay?.accessoryIds ?? [],
          // backward-compat: simplified default specs
          frameSpec: domain.frameSpec ? describeFrameSpec(domain.frameSpec) : null,
          beamSpec: firstBay?.beamSpec ? describeBeamSpec(firstBay.beamSpec) : null,
          // per-component detail
          frames: describeModuleFrames(domain),
          levels: describeModuleLevels(domain),
        } : null,
      };
    }
    case 'RACK_LINE': {
      const domain = rackDomainRef.current.get(entity.domainId);
      const firstModule = domain?.modules?.[0] ?? null;
      const firstBay = firstModule?.bays?.[0] ?? null;
      return {
        ...base,
        semanticRole: 'rack-line',
        domainId: entity.domainId,
        bayCount: entity.bayCount ?? domain?.totalBayCount ?? null,
        widthM: roundMetric(entity.widthM),
        depthM: roundMetric(entity.depthM),
        orientation: entity.transform.rotation === 90 ? 'vertical' : 'horizontal',
        rack: domain ? {
          id: domain.id,
          frameCount: domain.totalFrameCount ?? null,
          levelCount: firstModule?.levelUnion?.length ?? null,
          rowConfiguration: domain.rowConfiguration ?? null,
          levelMode: domain.levelMode ?? null,
          backToBackConfig: domain.backToBackConfig ?? null,
          accessoryIds: domain.accessoryIds ?? [],
          // backward-compat: simplified default specs from the first module
          frameSpec: firstModule?.frameSpec ? describeFrameSpec(firstModule.frameSpec) : null,
          beamSpec: firstBay?.beamSpec ? describeBeamSpec(firstBay.beamSpec) : null,
          // Option B: per-module breakdown
          modules: (domain.modules ?? []).map((mod) => {
            const modFirstBay = mod.bays?.[0] ?? null;
            return {
              id: mod.id,
              frameCount: mod.frameCount,
              startFrameIndex: mod.startFrameIndex,
              endFrameIndex: mod.endFrameIndex,
              levelCount: mod.levelUnion?.length ?? null,
              rowIndex: mod.rowIndex ?? null,
              frameSpec: describeFrameSpec(mod.frameSpec),
              beamSpec: modFirstBay?.beamSpec ? describeBeamSpec(modFirstBay.beamSpec) : null,
              frames: describeModuleFrames(mod),
              levels: describeModuleLevels(mod),
            };
          }),
        } : null,
      };
    }
    case 'WALL':
      return {
        ...base,
        semanticRole: 'wall-segment',
        lengthM: roundMetric(entity.lengthM),
        thicknessM: roundMetric(entity.thicknessM),
      };
    case 'COLUMN':
      return {
        ...base,
        semanticRole: 'structural-column',
        widthM: roundMetric(entity.widthM),
        depthM: roundMetric(entity.depthM),
        shape: entity.shape,
      };
    case 'TEXT_NOTE':
      return {
        ...base,
        semanticRole: 'text-note',
        text: entity.text,
        fontSizeM: roundMetric(entity.fontSizeM),
      };
    default:
      return base;
  }
}

export function logDrawnObjectSemantics(layoutStore, rackDomainRef) {
  if (!layoutStore) return;
  const selection = layoutStore.getSelection();
  const visibleEntities = layoutStore.getAll().filter((entity) => entity.visible);
  const semantics = visibleEntities.map((entity) =>
    describeEntitySemantics(entity, selection.has(entity.id), rackDomainRef),
  );
}
