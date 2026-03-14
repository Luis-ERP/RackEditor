import { useEffect } from 'react';
import {
  createRackModuleEntity,
  bresenhamLine,
} from '../../../services/layout';
import { buildRackModule } from '../../../services/rack';
import {
  DEFAULT_FRAME_SPEC,
  DEFAULT_BEAM_SPEC,
  DEFAULT_HOLE_INDICES,
  DEFAULT_BAY_WIDTH_M,
  DEFAULT_FRAME_DEPTH_M,
  BAY_STEP_M,
} from '../../../services/rack/catalog';

export default function useRackDrawingInteraction({
  canvasRef,
  layoutStore,
  worldAt,
  drawingModeRef,
  rackOrientationRef,
  dragRef,
  cellMapRef,
  rackDomainRef,
  rebuildCellMap,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    const bayW = DEFAULT_BAY_WIDTH_M;
    const bayD = DEFAULT_FRAME_DEPTH_M;

    const toBayCell = (wx, wy) => {
      const vert = rackOrientationRef.current === 'vertical';
      return vert
        ? { x: Math.floor(wx / bayD), y: Math.floor(wy / BAY_STEP_M) }
        : { x: Math.floor(wx / BAY_STEP_M), y: Math.floor(wy / bayD) };
    };

    const bayCellWorld = (cx, cy) => {
      const vert = rackOrientationRef.current === 'vertical';
      return vert
        ? { x: cx * bayD, y: cy * BAY_STEP_M }
        : { x: cx * BAY_STEP_M, y: cy * bayD };
    };

    const placedCells = new Set();
    const cellKey = (cx, cy) => `${cx},${cy}`;

    const bayLabel = (bayCount, vert) => {
      const dims = vert ? '42" × 96"' : '96" × 42"';
      return bayCount > 1 ? `${bayCount}× ${dims}` : dims;
    };

    const growSize = (n) => (n - 1) * BAY_STEP_M + bayW;

    const placeCell = (cx, cy) => {
      const key = cellKey(cx, cy);
      if (placedCells.has(key)) return false;

      const cm = cellMapRef.current;
      if (cm.has(key)) return false;

      const vert = rackOrientationRef.current === 'vertical';
      const w = bayCellWorld(cx, cy);
      const entW = vert ? bayD : bayW;
      const entD = vert ? bayW : bayD;

      if (layoutStore.hitTest(w.x + entW / 2, w.y + entD / 2)) return false;
      placedCells.add(key);

      const prevKey = vert ? cellKey(cx, cy - 1) : cellKey(cx - 1, cy);
      const nextKey = vert ? cellKey(cx, cy + 1) : cellKey(cx + 1, cy);
      const prevInfo = cm.get(prevKey);
      const nextInfo = cm.get(nextKey);

      const prevEnt = prevInfo ? layoutStore.get(prevInfo.entityId) : null;
      const nextEnt = nextInfo ? layoutStore.get(nextInfo.entityId) : null;
      const prevMod = prevEnt ? rackDomainRef.current.get(prevEnt.domainId) : null;
      const nextMod = nextEnt ? rackDomainRef.current.get(nextEnt.domainId) : null;
      const hasPrev = !!(prevEnt && prevMod);
      const hasNext = !!(nextEnt && nextMod);

      const modHoleIndices = (mod) => mod.levelUnion.map((l) => l.holeIndex);
      const frameSpecsMatch = (a, b) => a.frameSpec.id === b.frameSpec.id;

      if (hasPrev && hasNext && prevInfo.entityId !== nextInfo.entityId) {
        if (!frameSpecsMatch(prevMod, nextMod)) return false;

        const totalBays = prevMod.bays.length + 1 + nextMod.bays.length;
        const newMod = buildRackModule({
          frameSpec: prevMod.frameSpec,
          beamSpec: prevMod.bays[0].beamSpec,
          bayCount: totalBays,
          holeIndices: modHoleIndices(prevMod),
        });

        rackDomainRef.current.delete(prevEnt.domainId);
        rackDomainRef.current.delete(nextEnt.domainId);
        rackDomainRef.current.set(newMod.id, newMod);

        const newGrow = growSize(totalBays);
        layoutStore.update(prevEnt.id, {
          domainId: newMod.id,
          widthM: vert ? prevEnt.widthM : newGrow,
          depthM: vert ? newGrow : prevEnt.depthM,
          bayCount: totalBays,
          label: bayLabel(totalBays, vert),
        });
        layoutStore.remove(nextEnt.id);

        const newRef = { entityId: prevEnt.id, domainId: newMod.id };
        for (const [k, v] of cm) {
          if (v.entityId === prevInfo.entityId || v.entityId === nextInfo.entityId) {
            cm.set(k, newRef);
          }
        }
        cm.set(key, newRef);
      } else if (hasPrev) {
        const newBayCount = prevMod.bays.length + 1;
        const newMod = buildRackModule({
          frameSpec: prevMod.frameSpec,
          beamSpec: prevMod.bays[0].beamSpec,
          bayCount: newBayCount,
          holeIndices: modHoleIndices(prevMod),
        });

        rackDomainRef.current.delete(prevEnt.domainId);
        rackDomainRef.current.set(newMod.id, newMod);

        const newGrow = growSize(newBayCount);
        layoutStore.update(prevEnt.id, {
          domainId: newMod.id,
          widthM: vert ? prevEnt.widthM : newGrow,
          depthM: vert ? newGrow : prevEnt.depthM,
          bayCount: newBayCount,
          label: bayLabel(newBayCount, vert),
        });

        const newRef = { entityId: prevEnt.id, domainId: newMod.id };
        for (const [k, v] of cm) {
          if (v.entityId === prevInfo.entityId) cm.set(k, newRef);
        }
        cm.set(key, newRef);
      } else if (hasNext) {
        const newBayCount = nextMod.bays.length + 1;
        const newMod = buildRackModule({
          frameSpec: nextMod.frameSpec,
          beamSpec: nextMod.bays[0].beamSpec,
          bayCount: newBayCount,
          holeIndices: modHoleIndices(nextMod),
        });

        rackDomainRef.current.delete(nextEnt.domainId);
        rackDomainRef.current.set(newMod.id, newMod);

        const newGrow = growSize(newBayCount);
        layoutStore.moveTo(
          nextEnt.id,
          vert ? nextEnt.transform.x : nextEnt.transform.x - BAY_STEP_M,
          vert ? nextEnt.transform.y - BAY_STEP_M : nextEnt.transform.y,
        );
        layoutStore.update(nextEnt.id, {
          domainId: newMod.id,
          widthM: vert ? nextEnt.widthM : newGrow,
          depthM: vert ? newGrow : nextEnt.depthM,
          bayCount: newBayCount,
          label: bayLabel(newBayCount, vert),
        });

        const newRef = { entityId: nextEnt.id, domainId: newMod.id };
        for (const [k, v] of cm) {
          if (v.entityId === nextInfo.entityId) cm.set(k, newRef);
        }
        cm.set(key, newRef);
      } else {
        const rackModule = buildRackModule({
          frameSpec: DEFAULT_FRAME_SPEC,
          beamSpec: DEFAULT_BEAM_SPEC,
          bayCount: 1,
          holeIndices: DEFAULT_HOLE_INDICES,
        });
        rackDomainRef.current.set(rackModule.id, rackModule);

        const ent = layoutStore.add(createRackModuleEntity({
          x: w.x,
          y: w.y,
          rotation: vert ? 90 : 0,
          domainId: rackModule.id,
          widthM: entW,
          depthM: entD,
          label: bayLabel(1, vert),
        }));
        cm.set(key, { entityId: ent.id, domainId: rackModule.id });
      }

      return true;
    };

    const onDown = (e) => {
      if (!drawingModeRef.current || e.button !== 0) return;
      const world = worldAt(e);
      if (!world) return;

      e.preventDefault();
      placedCells.clear();
      rebuildCellMap();
      const cell = toBayCell(world.x, world.y);
      placeCell(cell.x, cell.y);
      dragRef.current = { active: true, lastCell: cell };
    };

    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const world = worldAt(e);
      if (!world) return;

      const cell = toBayCell(world.x, world.y);
      const last = dragRef.current.lastCell;
      if (cell.x === last.x && cell.y === last.y) return;

      const cells = bresenhamLine(last.x, last.y, cell.x, cell.y);
      for (const c of cells) placeCell(c.x, c.y);
      dragRef.current.lastCell = cell;
    };

    const onUp = () => {
      if (dragRef.current.active) {
        dragRef.current = { active: false, lastCell: null };
      }
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [canvasRef, cellMapRef, dragRef, drawingModeRef, layoutStore, rackDomainRef, rackOrientationRef, rebuildCellMap, worldAt]);
}
