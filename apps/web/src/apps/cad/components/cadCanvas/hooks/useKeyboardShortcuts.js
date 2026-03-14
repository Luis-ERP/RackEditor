import { useEffect } from 'react';

export default function useKeyboardShortcuts({
  drawingModeRef,
  wallModeRef,
  columnModeRef,
  subSelRef,
  setSubSel,
  onSubSelChangeRef,
  layoutStore,
  scheduleRedraw,
  handleDeleteSubSelected,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !drawingModeRef.current) {
        if (subSelRef.current) {
          subSelRef.current = null;
          setSubSel(null);
          onSubSelChangeRef.current?.(null);
          scheduleRedraw();
          return;
        }
        if (layoutStore && layoutStore.selectionCount() > 0) {
          layoutStore.deselectAll();
        }
      }

      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (!subSelRef.current && layoutStore && layoutStore.selectionCount() > 0) {
          layoutStore.duplicateSelected();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawingModeRef, layoutStore, onSubSelChangeRef, scheduleRedraw, setSubSel, subSelRef]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (drawingModeRef.current || wallModeRef.current || columnModeRef.current) return;

      e.preventDefault();
      if (subSelRef.current) {
        handleDeleteSubSelected();
      } else if (layoutStore && layoutStore.selectionCount() > 0) {
        layoutStore.removeSelected();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [columnModeRef, drawingModeRef, handleDeleteSubSelected, layoutStore, subSelRef, wallModeRef]);
}
