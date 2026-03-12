import { useEffect } from 'react';
import {
  createColumnEntity,
  snapPointToGrid,
} from '../../../services/layout';

export default function useColumnPlacementInteraction({
  canvasRef,
  layoutStore,
  worldAt,
  columnModeRef,
  columnStoreRef,
  scheduleRedraw,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    const onDown = (e) => {
      if (!columnModeRef.current || e.button !== 0) return;
      const world = worldAt(e);
      if (!world) return;

      e.preventDefault();
      const snapped = snapPointToGrid(world.x, world.y);
      const colStore = columnStoreRef.current;
      const widthM = colStore ? colStore.getDefaultWidth() : 0.4;
      const depthM = colStore ? colStore.getDefaultDepth() : 0.4;

      layoutStore.add(createColumnEntity({
        x: snapped.x,
        y: snapped.y,
        widthM,
        depthM,
      }));
      scheduleRedraw();
    };

    canvas.addEventListener('mousedown', onDown);
    return () => canvas.removeEventListener('mousedown', onDown);
  }, [canvasRef, columnModeRef, columnStoreRef, layoutStore, scheduleRedraw, worldAt]);
}
