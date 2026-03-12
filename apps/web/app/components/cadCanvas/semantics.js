export function roundMetric(value) {
  return Number(value.toFixed(3));
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
    case 'RACK_MODULE':
    case 'RACK_LINE': {
      const domain = rackDomainRef.current.get(entity.domainId);
      const firstBay = domain?.bays?.[0] ?? null;
      return {
        ...base,
        semanticRole: entity.type === 'RACK_MODULE' ? 'rack-module' : 'rack-line',
        domainId: entity.domainId,
        bayCount: entity.bayCount ?? domain?.bays?.length ?? domain?.totalBayCount ?? null,
        widthM: roundMetric(entity.widthM),
        depthM: roundMetric(entity.depthM),
        orientation: entity.transform.rotation === 90 ? 'vertical' : 'horizontal',
        rack: domain ? {
          id: domain.id,
          frameCount: domain.frameCount ?? domain.totalFrameCount ?? null,
          startFrameIndex: domain.startFrameIndex ?? null,
          endFrameIndex: domain.endFrameIndex ?? null,
          levelCount: domain.levelUnion?.length ?? null,
          rowConfiguration: domain.rowConfiguration ?? null,
          levelMode: domain.levelMode ?? null,
          backToBackConfig: domain.backToBackConfig ?? null,
          accessoryIds: domain.accessoryIds ?? firstBay?.accessoryIds ?? [],
          frameSpec: domain.frameSpec ? {
            id: domain.frameSpec.id,
            heightIn: domain.frameSpec.heightIn,
            depthIn: domain.frameSpec.depthIn,
            gauge: domain.frameSpec.gauge,
            capacityClass: domain.frameSpec.capacityClass,
            uprightSeries: domain.frameSpec.uprightSeries,
            basePlateType: domain.frameSpec.basePlateType ?? null,
          } : null,
          beamSpec: firstBay?.beamSpec ? {
            id: firstBay.beamSpec.id,
            lengthIn: firstBay.beamSpec.lengthIn,
            capacityLbPair: firstBay.beamSpec.capacityLbPair,
            series: firstBay.beamSpec.series ?? null,
          } : null,
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
  console.log('[CADCanvas] Drawn object semantics', semantics);
}
