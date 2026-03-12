import { useEffect } from 'react';

export default function useCanvasModeSync({
  drawingMode,
  drawingModeRef,
  rackOrientation,
  rackOrientationRef,
  wallMode,
  wallModeRef,
  wallStore,
  wallStoreRef,
  wallPreviewRef,
  columnMode,
  columnModeRef,
  columnStore,
  columnStoreRef,
  subSelRef,
  setSubSel,
  onSubSelChangeRef,
  layoutStore,
  selDragRef,
  selRectRef,
  dragRef,
  scheduleRedraw,
}) {
  useEffect(() => {
    rackOrientationRef.current = rackOrientation;
  }, [rackOrientation, rackOrientationRef]);

  useEffect(() => {
    wallStoreRef.current = wallStore;
  }, [wallStore, wallStoreRef]);

  useEffect(() => {
    wallModeRef.current = wallMode;
    if (!wallMode) {
      wallPreviewRef.current = null;
      scheduleRedraw();
    }
    if (wallMode && layoutStore) {
      if (subSelRef.current) {
        subSelRef.current = null;
        setSubSel(null);
        onSubSelChangeRef.current?.(null);
      }
      layoutStore.deselectAll();
      selDragRef.current = null;
      selRectRef.current = null;
      scheduleRedraw();
    }
  }, [layoutStore, onSubSelChangeRef, scheduleRedraw, selDragRef, selRectRef, setSubSel, subSelRef, wallMode, wallModeRef, wallPreviewRef]);

  useEffect(() => {
    columnStoreRef.current = columnStore;
  }, [columnStore, columnStoreRef]);

  useEffect(() => {
    columnModeRef.current = columnMode;
    if (columnMode && layoutStore) {
      if (subSelRef.current) {
        subSelRef.current = null;
        setSubSel(null);
        onSubSelChangeRef.current?.(null);
      }
      layoutStore.deselectAll();
      selDragRef.current = null;
      selRectRef.current = null;
      scheduleRedraw();
    }
  }, [columnMode, columnModeRef, layoutStore, onSubSelChangeRef, scheduleRedraw, selDragRef, selRectRef, setSubSel, subSelRef]);

  useEffect(() => {
    drawingModeRef.current = drawingMode;
    if (!drawingMode && dragRef.current.active) {
      dragRef.current = { active: false, lastCell: null };
    }
    if (drawingMode && layoutStore) {
      if (subSelRef.current) {
        subSelRef.current = null;
        setSubSel(null);
        onSubSelChangeRef.current?.(null);
      }
      layoutStore.deselectAll();
      selDragRef.current = null;
      selRectRef.current = null;
      scheduleRedraw();
    }
  }, [dragRef, drawingMode, drawingModeRef, layoutStore, onSubSelChangeRef, scheduleRedraw, selDragRef, selRectRef, setSubSel, subSelRef]);
}
