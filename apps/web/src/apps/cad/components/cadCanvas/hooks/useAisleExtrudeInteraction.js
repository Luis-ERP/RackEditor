import { useEffect, useRef } from 'react';
import { RULER_SIZE } from '../../../services/coordinateSystem';
import { aisleExtrudeHandlePositions, EXTRUDE_HANDLE_R_PX } from '../../../services/layout/renderers';
import { buildRackModule } from '../../../services/rack';
import {
  BAY_STEP_M,
  DEFAULT_FRAME_SPEC,
  DEFAULT_BEAM_SPEC,
  DEFAULT_HOLE_INDICES,
} from '../../../services/rack/catalog';

// ── Helpers ──────────────────────────────────────────────────────────────────

function hitTestExtrudeHandles(sx, sy, layoutStore, cam) {
  const selected = layoutStore.getSelectedEntities().filter(
    (e) => (e.type === 'RACK_MODULE' || e.type === 'RACK_LINE') && e.visible,
  );
  const R = EXTRUDE_HANDLE_R_PX;
  for (const entity of selected) {
    const handles = aisleExtrudeHandlePositions(entity, cam);
    if (!handles) continue;
    for (const h of handles) {
      const dx = sx - h.screenX;
      const dy = sy - h.screenY;
      if (dx * dx + dy * dy <= R * R) return { entity, side: h.side, dir: h.dir, axis: h.axis };
    }
  }
  return null;
}

function bayLabel(count, rotation) {
  const vert = rotation === 90;
  const dims = vert ? '42" × 96"' : '96" × 42"';
  return count > 1 ? `${count}× ${dims}` : dims;
}

/**
 * Compute how many bays to add (N) from cursor position relative to the dragged entity edge.
 * Returns N (>= 1) or 0 when the cursor hasn't crossed an edge yet.
 */
function computeN(entity, axis, dir, worldX, worldY) {
  let dragDelta;
  if (axis === 'x') {
    dragDelta = dir === 1
      ? worldX - (entity.transform.x + entity.widthM)
      : entity.transform.x - worldX;
  } else {
    dragDelta = dir === 1
      ? worldY - (entity.transform.y + entity.depthM)
      : entity.transform.y - worldY;
  }
  return Math.max(0, Math.round(dragDelta / BAY_STEP_M));
}

/**
 * Build the ghost and commit state for one entity given a known N.
 */
function buildExtrudeState(entity, axis, dir, N) {
  if (N <= 0) return null;

  if (axis === 'x') {
    const addedW = N * BAY_STEP_M;
    const ghostX = dir === 1
      ? entity.transform.x + entity.widthM
      : entity.transform.x - addedW;

    return {
      N,
      newBayCount: (entity.bayCount ?? 1) + N,
      ghostEntity: {
        ...entity,
        id: `__extrude_ghost_${entity.id}__`,
        transform: { ...entity.transform, x: ghostX },
        widthM: addedW,
        depthM: entity.depthM,
        bayCount: N,
        visible: true,
      },
      newX: dir === 1 ? entity.transform.x : entity.transform.x - addedW,
      newY: entity.transform.y,
      axisGrew: 'width',
      newExtent: entity.widthM + addedW,
    };
  } else {
    const addedD = N * BAY_STEP_M;
    const ghostY = dir === 1
      ? entity.transform.y + entity.depthM
      : entity.transform.y - addedD;

    return {
      N,
      newBayCount: (entity.bayCount ?? 1) + N,
      ghostEntity: {
        ...entity,
        id: `__extrude_ghost_${entity.id}__`,
        transform: { ...entity.transform, y: ghostY },
        widthM: entity.widthM,
        depthM: addedD,
        bayCount: N,
        visible: true,
      },
      newX: entity.transform.x,
      newY: dir === 1 ? entity.transform.y : entity.transform.y - addedD,
      axisGrew: 'depth',
      newExtent: entity.depthM + addedD,
    };
  }
}

/**
 * Commit the expansion to the store and (for RACK_MODULE) update the domain model.
 */
function commitExpansion(entity, state, layoutStore, rackDomainRef) {
  const { newBayCount, newX, newY, axisGrew, newExtent } = state;
  const domainMap = rackDomainRef?.current;

  const patch = {
    bayCount: newBayCount,
    label: bayLabel(newBayCount, entity.transform.rotation),
    ...(axisGrew === 'width' ? { widthM: newExtent } : { depthM: newExtent }),
  };

  if (entity.type === 'RACK_MODULE' && domainMap && entity.domainId) {
    const prevMod = domainMap.get(entity.domainId);
    if (prevMod) {
      const beamSpec = prevMod.bays?.[0]?.beamSpec ?? DEFAULT_BEAM_SPEC;
      const holeIndices = Array.isArray(prevMod.levelUnion)
        ? prevMod.levelUnion.map((l) => l?.holeIndex).filter(Number.isInteger)
        : DEFAULT_HOLE_INDICES;

      const newMod = buildRackModule({
        frameSpec: prevMod.frameSpec ?? DEFAULT_FRAME_SPEC,
        beamSpec,
        bayCount: newBayCount,
        holeIndices: holeIndices.length > 0 ? holeIndices : DEFAULT_HOLE_INDICES,
      });

      domainMap.delete(entity.domainId);
      domainMap.set(newMod.id, newMod);
      patch.domainId = newMod.id;
    }
  }

  layoutStore.update(entity.id, patch);

  if (newX !== entity.transform.x || newY !== entity.transform.y) {
    layoutStore.moveTo(entity.id, newX, newY);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Extrude handles: click-drag an arrow at either end of a selected rack aisle to
 * grow ALL selected aisles in-place by the same number of bays.
 *
 * Must be wired into CADCanvas BEFORE useSelectionInteraction so its mousedown can
 * call stopImmediatePropagation when a handle is hit.
 */
export default function useAisleExtrudeInteraction({
  canvasRef,
  layoutStore,
  camera,
  scheduleRedraw,
  worldAt,
  drawingModeRef,
  wallModeRef,
  columnModeRef,
  noteModeRef,
  extrudeGhostRef,
  rackDomainRef,
}) {
  const dragRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    const onDown = (e) => {
      if (
        drawingModeRef.current ||
        wallModeRef.current ||
        columnModeRef.current ||
        (noteModeRef && noteModeRef.current) ||
        e.button !== 0
      ) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (sx < RULER_SIZE || sy < RULER_SIZE) return;

      const hit = hitTestExtrudeHandles(sx, sy, layoutStore, camera.current);
      if (!hit) return;

      e.stopImmediatePropagation();
      e.preventDefault();

      // Snapshot all selected aisles so their dims stay stable during drag
      const allSelected = layoutStore.getSelectedEntities().filter(
        (e) => (e.type === 'RACK_MODULE' || e.type === 'RACK_LINE') && e.visible,
      ).map((e) => ({ ...e, transform: { ...e.transform } }));

      dragRef.current = {
        entity: { ...hit.entity, transform: { ...hit.entity.transform } },
        axis: hit.axis,
        dir: hit.dir,
        allEntities: allSelected,
      };
      extrudeGhostRef.current = null;
      canvas.style.cursor = 'grabbing';
      scheduleRedraw();
    };

    const onMove = (e) => {
      const cam = camera.current;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (!dragRef.current) {
        // Hover cursor
        if (
          sx >= RULER_SIZE && sy >= RULER_SIZE &&
          !drawingModeRef.current && !wallModeRef.current &&
          !columnModeRef.current && !(noteModeRef && noteModeRef.current)
        ) {
          const hit = hitTestExtrudeHandles(sx, sy, layoutStore, cam);
          canvas.style.cursor = hit ? 'grab' : '';
        }
        return;
      }

      const world = worldAt(e);
      if (!world) return;

      const { entity, axis, dir, allEntities } = dragRef.current;
      const N = computeN(entity, axis, dir, world.x, world.y);

      if (N <= 0) {
        extrudeGhostRef.current = null;
        scheduleRedraw();
        return;
      }

      // Build ghost state for every selected aisle using the same N
      const ghosts = allEntities.map((ent) => {
        const entAxis = ent.transform.rotation === 90 ? 'y' : 'x';
        const state = buildExtrudeState(ent, entAxis, dir, N);
        return state ? { entity: ent, ghostEntity: state.ghostEntity, state } : null;
      }).filter(Boolean);

      extrudeGhostRef.current = ghosts.length > 0 ? { ghosts, N } : null;
      scheduleRedraw();
    };

    const onUp = () => {
      if (!dragRef.current) return;

      const ghost = extrudeGhostRef.current;
      if (ghost) {
        for (const { entity, state } of ghost.ghosts) {
          commitExpansion(entity, state, layoutStore, rackDomainRef);
        }
      }

      dragRef.current = null;
      extrudeGhostRef.current = null;
      canvas.style.cursor = '';
      scheduleRedraw();
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [
    camera,
    canvasRef,
    columnModeRef,
    drawingModeRef,
    extrudeGhostRef,
    layoutStore,
    noteModeRef,
    rackDomainRef,
    scheduleRedraw,
    wallModeRef,
    worldAt,
  ]);
}
