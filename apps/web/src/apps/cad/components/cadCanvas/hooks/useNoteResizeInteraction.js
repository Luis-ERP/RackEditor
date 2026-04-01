import { useEffect, useRef } from 'react';
import { EntityType } from '../../../services/layout';

const HANDLE_SIZE_PX = 8;

/**
 * Returns the screen-space position of the bottom-right resize handle for a
 * TEXT_NOTE entity given the current camera.
 */
function getResizeHandle(entity, cam) {
  const sx = cam.x + entity.transform.x * cam.zoom;
  const sy = cam.y + entity.transform.y * cam.zoom;
  const sw = (entity.widthM ?? 2) * cam.zoom;
  const sh = (entity.heightM ?? 1) * cam.zoom;
  return {
    cx: sx + sw,
    cy: sy + sh,
  };
}

/**
 * Check if a screen point is over a note's resize handle.
 */
function hitTestHandle(entity, cam, screenX, screenY) {
  const { cx, cy } = getResizeHandle(entity, cam);
  const half = HANDLE_SIZE_PX / 2 + 2; // small tolerance
  return Math.abs(screenX - cx) <= half && Math.abs(screenY - cy) <= half;
}

export default function useNoteResizeInteraction({
  canvasRef,
  layoutStore,
  camera,
  scheduleRedraw,
}) {
  const dragRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    const onDown = (e) => {
      if (e.button !== 0) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = camera.current;

      // Check all selected TEXT_NOTE entities for a resize-handle hit
      const selected = layoutStore.getSelectedEntities();
      for (const ent of selected) {
        if (ent.type !== EntityType.TEXT_NOTE) continue;
        if (hitTestHandle(ent, cam, sx, sy)) {
          e.preventDefault();
          e.stopPropagation();
          dragRef.current = {
            entityId: ent.id,
            startSx: sx,
            startSy: sy,
            origWidthM: ent.widthM ?? 2,
            origHeightM: ent.heightM ?? 1,
          };
          return;
        }
      }
    };

    const onMove = (e) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = camera.current;

      const dx = (sx - dragRef.current.startSx) / cam.zoom;
      const dy = (sy - dragRef.current.startSy) / cam.zoom;

      const newW = Math.max(0.3, dragRef.current.origWidthM + dx);
      const newH = Math.max(0.2, dragRef.current.origHeightM + dy);

      layoutStore.update(dragRef.current.entityId, {
        widthM: newW,
        heightM: newH,
      });
      scheduleRedraw();
    };

    const onUp = () => {
      dragRef.current = null;
    };

    // Use capture phase so we intercept before the selection drag handler
    canvas.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [canvasRef, layoutStore, camera, scheduleRedraw]);
}
