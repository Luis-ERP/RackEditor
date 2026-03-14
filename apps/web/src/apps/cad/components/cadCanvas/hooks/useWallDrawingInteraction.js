import { useEffect } from 'react';
import {
  createWallEntity,
  snapPointToGrid,
} from '../../../services/layout';

export default function useWallDrawingInteraction({
  canvasRef,
  layoutStore,
  worldAt,
  wallModeRef,
  wallStoreRef,
  wallPreviewRef,
  scheduleRedraw,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    let wallDragStart = null;

    const onDown = (e) => {
      if (!wallModeRef.current || e.button !== 0) return;
      const world = worldAt(e);
      if (!world) return;

      e.preventDefault();
      const snapped = snapPointToGrid(world.x, world.y);
      wallDragStart = snapped;
      wallPreviewRef.current = {
        mode: wallModeRef.current,
        startX: snapped.x,
        startY: snapped.y,
        endX: snapped.x,
        endY: snapped.y,
        thicknessM: wallStoreRef.current?.getDefaultThickness() ?? 0.2,
      };
      scheduleRedraw();
    };

    const onMove = (e) => {
      if (!wallDragStart) return;
      const world = worldAt(e);
      if (!world) return;

      const snapped = snapPointToGrid(world.x, world.y);
      wallPreviewRef.current = {
        ...wallPreviewRef.current,
        endX: snapped.x,
        endY: snapped.y,
      };
      scheduleRedraw();
    };

    const onUp = () => {
      if (!wallDragStart || !wallPreviewRef.current) return;

      const { startX, startY, endX, endY, thicknessM, mode } = wallPreviewRef.current;
      wallDragStart = null;
      wallPreviewRef.current = null;

      if (mode === 'line') {
        const dx = endX - startX;
        const dy = endY - startY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) {
          scheduleRedraw();
          return;
        }
        const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
        layoutStore.add(createWallEntity({
          x: startX,
          y: startY,
          rotation,
          lengthM: len,
          thicknessM,
        }));
      } else if (mode === 'rect') {
        const minX = Math.min(startX, endX);
        const minY = Math.min(startY, endY);
        const maxX = Math.max(startX, endX);
        const maxY = Math.max(startY, endY);
        const w = maxX - minX;
        const h = maxY - minY;

        if (w < 0.1 && h < 0.1) {
          scheduleRedraw();
          return;
        }

        if (w >= 0.1) {
          layoutStore.add(createWallEntity({ x: minX, y: minY, rotation: 0, lengthM: w, thicknessM }));
          layoutStore.add(createWallEntity({ x: minX, y: maxY, rotation: 0, lengthM: w, thicknessM }));
        }
        if (h >= 0.1) {
          layoutStore.add(createWallEntity({ x: minX, y: minY, rotation: 90, lengthM: h, thicknessM }));
          layoutStore.add(createWallEntity({ x: maxX, y: minY, rotation: 90, lengthM: h, thicknessM }));
        }
      }

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
  }, [canvasRef, layoutStore, scheduleRedraw, wallModeRef, wallPreviewRef, wallStoreRef, worldAt]);
}
