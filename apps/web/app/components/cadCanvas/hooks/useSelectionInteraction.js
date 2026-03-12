import { useEffect } from 'react';
import { RULER_SIZE, screenToWorld } from '../../../services/coordinateSystem';
import { BAY_STEP_M } from '../../../services/rack/catalog';

export default function useSelectionInteraction({
  canvasRef,
  layoutStore,
  camera,
  scheduleRedraw,
  worldAt,
  drawingModeRef,
  wallModeRef,
  columnModeRef,
  subSelRef,
  setSubSel,
  onSubSelChangeRef,
  lastClickInfoRef,
  moveDragRef,
  selDragRef,
  selRectRef,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    const onDown = (e) => {
      if (drawingModeRef.current || wallModeRef.current || columnModeRef.current || e.button !== 0) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (sx < RULER_SIZE || sy < RULER_SIZE) return;

      e.preventDefault();
      const world = screenToWorld(sx, sy, camera.current);
      const hit = layoutStore.hitTest(world.x, world.y);

      if (hit) {
        const now = Date.now();
        const last = lastClickInfoRef.current;
        const isDoubleClick = last && last.entityId === hit.id && now - last.time < 350;

        if (isDoubleClick && hit.type === 'RACK_MODULE' && (hit.bayCount ?? 1) > 1) {
          lastClickInfoRef.current = null;
          const vert = hit.transform.rotation === 90;
          const relCoord = vert ? world.y - hit.transform.y : world.x - hit.transform.x;
          const bayIdx = Math.max(0, Math.min(hit.bayCount - 1, Math.floor(relCoord / BAY_STEP_M)));
          const newSubSel = {
            entityId: hit.id,
            bayIndex: bayIdx,
            bayCount: hit.bayCount,
            vert,
          };
          subSelRef.current = newSubSel;
          setSubSel(newSubSel);
          onSubSelChangeRef.current?.(newSubSel);
          layoutStore.deselectAll();
          scheduleRedraw();
          return;
        }

        if (subSelRef.current) {
          subSelRef.current = null;
          setSubSel(null);
          onSubSelChangeRef.current?.(null);
        }

        lastClickInfoRef.current = { entityId: hit.id, time: now };

        if (e.shiftKey) {
          layoutStore.toggleSelect(hit.id);
        } else {
          layoutStore.select(hit.id, true);
        }

        moveDragRef.current = { startWX: world.x, startWY: world.y };
        return;
      }

      if (subSelRef.current) {
        subSelRef.current = null;
        setSubSel(null);
        onSubSelChangeRef.current?.(null);
      }

      lastClickInfoRef.current = null;
      selDragRef.current = { sx, sy, ex: sx, ey: sy };
      selRectRef.current = null;
    };

    const onMove = (e) => {
      if (moveDragRef.current) {
        const world = worldAt(e);
        if (!world) return;

        const dx = world.x - moveDragRef.current.startWX;
        const dy = world.y - moveDragRef.current.startWY;
        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
          layoutStore.moveSelectedBy(dx, dy);
          moveDragRef.current.startWX = world.x;
          moveDragRef.current.startWY = world.y;
        }
        return;
      }

      if (!selDragRef.current) return;

      const rect = canvas.getBoundingClientRect();
      selDragRef.current.ex = e.clientX - rect.left;
      selDragRef.current.ey = e.clientY - rect.top;

      const { sx: x0, sy: y0, ex: x1, ey: y1 } = selDragRef.current;
      selRectRef.current = {
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        w: Math.abs(x1 - x0),
        h: Math.abs(y1 - y0),
      };
      scheduleRedraw();
    };

    const onUp = () => {
      if (moveDragRef.current) {
        moveDragRef.current = null;
        return;
      }

      if (!selDragRef.current) return;

      const { sx: x0, sy: y0, ex: x1, ey: y1 } = selDragRef.current;
      selDragRef.current = null;
      selRectRef.current = null;

      const cam = camera.current;
      const wA = screenToWorld(Math.min(x0, x1), Math.min(y0, y1), cam);
      const wB = screenToWorld(Math.max(x0, x1), Math.max(y0, y1), cam);

      layoutStore.selectByRect({
        minX: wA.x,
        minY: wA.y,
        maxX: wB.x,
        maxY: wB.y,
      }, true);

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
    lastClickInfoRef,
    layoutStore,
    moveDragRef,
    onSubSelChangeRef,
    scheduleRedraw,
    selDragRef,
    selRectRef,
    setSubSel,
    subSelRef,
    wallModeRef,
    worldAt,
  ]);
}
