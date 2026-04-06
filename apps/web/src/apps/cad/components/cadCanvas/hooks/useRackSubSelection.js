import { useCallback, useEffect, useState } from 'react';
import { createRackModuleEntity } from '../../../services/layout';
import { buildRackModule } from '../../../services/rack';
import {
  DEFAULT_FRAME_SPEC,
  DEFAULT_BEAM_SPEC,
  DEFAULT_HOLE_INDICES,
  DEFAULT_BAY_WIDTH_M,
  BAY_STEP_M,
} from '../../../services/rack/catalog';

export default function useRackSubSelection({
  layoutStore,
  rackDomainRef,
  rackOrientationRef,
  cellMapRef,
  subSelRef,
  scheduleRedraw,
  onSubSelChange,
  defaultFrameDepthM,
}) {
  const [subSel, setSubSel] = useState(null);

  const rebuildCellMap = useCallback(() => {
    const cm = cellMapRef.current;
    cm.clear();
    const domainMap = rackDomainRef?.current;
    if (!domainMap || typeof domainMap.get !== 'function') return;

    const currentVert = rackOrientationRef.current === 'vertical';
    const entities = layoutStore ? layoutStore.getAllByType('RACK_MODULE') : [];

    for (const ent of entities) {
      const entVert = ent.transform.rotation === 90;
      if (entVert !== currentVert) continue;
      const mod = domainMap.get(ent.domainId);
      if (!mod) continue;

      const bayCount = mod.bays.length;
      for (let i = 0; i < bayCount; i++) {
        const wx = entVert ? ent.transform.x : ent.transform.x + i * BAY_STEP_M;
        const wy = entVert ? ent.transform.y + i * BAY_STEP_M : ent.transform.y;
        const ccx = currentVert ? Math.round(wx / defaultFrameDepthM) : Math.round(wx / BAY_STEP_M);
        const ccy = currentVert ? Math.round(wy / BAY_STEP_M) : Math.round(wy / defaultFrameDepthM);
        cm.set(`${ccx},${ccy}`, { entityId: ent.id, domainId: ent.domainId });
      }
    }
  }, [cellMapRef, defaultFrameDepthM, layoutStore, rackDomainRef, rackOrientationRef]);

  const clearSubSel = useCallback(() => {
    subSelRef.current = null;
    setSubSel(null);
    onSubSelChange.current?.(null);
    scheduleRedraw();
  }, [onSubSelChange, scheduleRedraw, subSelRef]);

  const fragmentEntity = useCallback((entityId, bayIndex) => {
    if (!layoutStore) return null;
    const ent = layoutStore.get(entityId);
    if (!ent) return null;

    const mod = rackDomainRef.current.get(ent.domainId);
    if (!mod) return null;

    const bayCount = mod.bays.length;
    if (bayIndex < 0 || bayIndex >= bayCount) return null;

    const vert = ent.transform.rotation === 90;
    const ox = ent.transform.x;
    const oy = ent.transform.y;
    const bayW = DEFAULT_BAY_WIDTH_M;
    const growSize = (n) => (n - 1) * BAY_STEP_M + bayW;
    const bayLabel = (n, isVertical) => {
      const dims = isVertical ? '42" × 96"' : '96" × 42"';
      return n > 1 ? `${n}× ${dims}` : dims;
    };

    const leftCount = bayIndex;
    const rightCount = bayCount - bayIndex - 1;
    const targetOx = vert ? ox : ox + bayIndex * BAY_STEP_M;
    const targetOy = vert ? oy + bayIndex * BAY_STEP_M : oy;
    const rightOx = vert ? ox : targetOx + BAY_STEP_M;
    const rightOy = vert ? targetOy + BAY_STEP_M : oy;
    const inheritedB2B = {
      rowConfiguration: ent.rowConfiguration ?? 'SINGLE',
      spacerSizeIn: ent.spacerSizeIn ?? 6,
      frameHeightIn: ent.frameHeightIn,
      spacersPerRowPair: ent.spacersPerRowPair,
    };

    rackDomainRef.current.delete(ent.domainId);

    let leftEntityId = null;
    let targetEntityId = null;
    let rightEntityId = null;

    if (leftCount > 0) {
      const leftMod = buildRackModule({
        frameSpec: DEFAULT_FRAME_SPEC,
        beamSpec: DEFAULT_BEAM_SPEC,
        bayCount: leftCount,
        holeIndices: DEFAULT_HOLE_INDICES,
      });
      rackDomainRef.current.set(leftMod.id, leftMod);
      layoutStore.update(ent.id, {
        domainId: leftMod.id,
        widthM: vert ? ent.widthM : growSize(leftCount),
        depthM: vert ? growSize(leftCount) : ent.depthM,
        bayCount: leftCount,
        rowConfiguration: inheritedB2B.rowConfiguration,
        spacerSizeIn: inheritedB2B.spacerSizeIn,
        frameHeightIn: inheritedB2B.frameHeightIn,
        spacersPerRowPair: inheritedB2B.spacersPerRowPair,
        label: bayLabel(leftCount, vert),
      });
      leftEntityId = ent.id;

      const targetMod = buildRackModule({
        frameSpec: DEFAULT_FRAME_SPEC,
        beamSpec: DEFAULT_BEAM_SPEC,
        bayCount: 1,
        holeIndices: DEFAULT_HOLE_INDICES,
      });
      rackDomainRef.current.set(targetMod.id, targetMod);
      const targetEnt = layoutStore.add(createRackModuleEntity({
        x: targetOx,
        y: targetOy,
        rotation: vert ? 90 : 0,
        domainId: targetMod.id,
        widthM: vert ? ent.widthM : bayW,
        depthM: vert ? bayW : ent.depthM,
        label: bayLabel(1, vert),
        bayCount: 1,
        ...inheritedB2B,
      }));
      targetEntityId = targetEnt.id;
    } else {
      const targetMod = buildRackModule({
        frameSpec: DEFAULT_FRAME_SPEC,
        beamSpec: DEFAULT_BEAM_SPEC,
        bayCount: 1,
        holeIndices: DEFAULT_HOLE_INDICES,
      });
      rackDomainRef.current.set(targetMod.id, targetMod);
      layoutStore.update(ent.id, {
        domainId: targetMod.id,
        widthM: vert ? ent.widthM : bayW,
        depthM: vert ? bayW : ent.depthM,
        bayCount: 1,
        rowConfiguration: inheritedB2B.rowConfiguration,
        spacerSizeIn: inheritedB2B.spacerSizeIn,
        frameHeightIn: inheritedB2B.frameHeightIn,
        spacersPerRowPair: inheritedB2B.spacersPerRowPair,
        label: bayLabel(1, vert),
      });
      targetEntityId = ent.id;
    }

    if (rightCount > 0) {
      const rightMod = buildRackModule({
        frameSpec: DEFAULT_FRAME_SPEC,
        beamSpec: DEFAULT_BEAM_SPEC,
        bayCount: rightCount,
        holeIndices: DEFAULT_HOLE_INDICES,
      });
      rackDomainRef.current.set(rightMod.id, rightMod);
      const rightEnt = layoutStore.add(createRackModuleEntity({
        x: rightOx,
        y: rightOy,
        rotation: vert ? 90 : 0,
        domainId: rightMod.id,
        widthM: vert ? ent.widthM : growSize(rightCount),
        depthM: vert ? growSize(rightCount) : ent.depthM,
        label: bayLabel(rightCount, vert),
        bayCount: rightCount,
        ...inheritedB2B,
      }));
      rightEntityId = rightEnt.id;
    }

    rebuildCellMap();
    return { leftEntityId, targetEntityId, rightEntityId };
  }, [defaultFrameDepthM, layoutStore, rackDomainRef, rebuildCellMap]);

  const handleDeleteSubSelected = useCallback(() => {
    const currentSubSel = subSelRef.current;
    if (!currentSubSel || !layoutStore) return;

    const ent = layoutStore.get(currentSubSel.entityId);
    if (!ent) {
      clearSubSel();
      return;
    }

    const result = fragmentEntity(currentSubSel.entityId, currentSubSel.bayIndex);
    if (!result) {
      clearSubSel();
      return;
    }

    const isolatedEnt = layoutStore.get(result.targetEntityId);
    if (isolatedEnt) {
      rackDomainRef.current.delete(isolatedEnt.domainId);
      layoutStore.remove(result.targetEntityId);
    }

    rebuildCellMap();
    clearSubSel();
  }, [clearSubSel, fragmentEntity, layoutStore, rackDomainRef, rebuildCellMap, subSelRef]);

  useEffect(() => {
    if (!subSel || !layoutStore) return;

    const check = () => {
      const ent = layoutStore.get(subSel.entityId);
      if (!ent || (ent.bayCount ?? 1) !== subSel.bayCount) {
        subSelRef.current = null;
        setSubSel(null);
        onSubSelChange.current?.(null);
      }
    };

    return layoutStore.subscribe(check);
  }, [layoutStore, onSubSelChange, subSel, subSelRef]);

  return {
    subSel,
    setSubSel,
    subSelRef,
    rebuildCellMap,
    clearSubSel,
    handleDeleteSubSelected,
  };
}
