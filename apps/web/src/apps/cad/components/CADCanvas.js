'use client';

import { useRef, useEffect, useCallback } from 'react';
import { DEFAULT_FRAME_DEPTH_M, BAY_STEP_M } from '../services/rack/catalog';
import {
  CanvasActionsBar,
  CanvasModeBanners,
  CanvasHUDs,
  CanvasDrawingToolbar,
} from './cadCanvas/CADCanvasOverlays';
import { wrapperStyle, getOverlayTheme } from './cadCanvas/styles';
import useCanvasViewport from './cadCanvas/hooks/useCanvasViewport';
import useCanvasModeSync from './cadCanvas/hooks/useCanvasModeSync';
import useKeyboardShortcuts from './cadCanvas/hooks/useKeyboardShortcuts';
import useRackSubSelection from './cadCanvas/hooks/useRackSubSelection';
import useRackDrawingInteraction from './cadCanvas/hooks/useRackDrawingInteraction';
import useWallDrawingInteraction from './cadCanvas/hooks/useWallDrawingInteraction';
import useColumnPlacementInteraction from './cadCanvas/hooks/useColumnPlacementInteraction';
import useSelectionInteraction from './cadCanvas/hooks/useSelectionInteraction';
import useNotePlacementInteraction from './cadCanvas/hooks/useNotePlacementInteraction';
import useNoteResizeInteraction from './cadCanvas/hooks/useNoteResizeInteraction';
import { useAppTheme } from '@/src/shared/theme/AppThemeProvider';

export default function CADCanvas(props) {
  const { isDark, toggleTheme } = useAppTheme();

  const {
    drawingMode = false,
    layoutStore,
    layoutVersion,
    rackOrientation = 'horizontal',
    wallMode = null,
    wallStore = null,
    columnMode = false,
    columnStore = null,
    noteMode = false,
    noteStore = null,
    showMeasurements = false,
    onToggleDrawingMode,
    onSetWallMode,
    onToggleColumnMode,
    onToggleNoteMode,
    onToggleMeasurements,
  } = props;

  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const camera = useRef({ x: 0, y: 0, zoom: 1 });
  const rafId = useRef(null);
  const needsInit = useRef(true);
  const sizeRef = useRef({ w: 0, h: 0 });
  const baseZoom = useRef(1);
  const darkRef = useRef(isDark);

  const drawingModeRef = useRef(drawingMode);
  const rackOrientationRef = useRef(rackOrientation);
  const dragRef = useRef({ active: false, lastCell: null });

  const wallModeRef = useRef(wallMode);
  const wallStoreRef = useRef(wallStore);
  const wallPreviewRef = useRef(null);

  const columnModeRef = useRef(columnMode);
  const columnStoreRef = useRef(columnStore);

  const noteModeRef = useRef(noteMode);
  const noteStoreRef = useRef(noteStore);

  const selDragRef = useRef(null);
  const selRectRef = useRef(null);
  const moveDragRef = useRef(null);

  const cellMapRef = useRef(new Map());
  const subSelRef = useRef(null);

  const localDomainRef = useRef(new Map());
  const rackDomainRef = props.rackDomainRef || localDomainRef;

  const lastClickInfoRef = useRef(null);
  const onSubSelChangeRef = useRef(props.onSubSelChange);

  const {
    scheduleRedraw,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    zoomPercent,
    cursorCoord,
    worldAt,
  } = useCanvasViewport({
    canvasRef,
    wrapperRef,
    camera,
    rafId,
    needsInit,
    sizeRef,
    baseZoom,
    darkRef,
    layoutStore,
    layoutVersion,
    wallPreviewRef,
    selRectRef,
    subSelRef,
    rackDomainRef,
    showMeasurements,
  });

  const {
    subSel,
    setSubSel,
    rebuildCellMap,
    clearSubSel,
    handleDeleteSubSelected,
  } = useRackSubSelection({
    layoutStore,
    rackDomainRef,
    rackOrientationRef,
    cellMapRef,
    subSelRef,
    scheduleRedraw,
    onSubSelChange: onSubSelChangeRef,
    defaultFrameDepthM: DEFAULT_FRAME_DEPTH_M,
  });

  useEffect(() => {
    darkRef.current = isDark;
    scheduleRedraw();
  }, [isDark, scheduleRedraw]);

  useEffect(() => {
    onSubSelChangeRef.current = props.onSubSelChange;
  }, [props.onSubSelChange]);

  useCanvasModeSync({
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
    noteMode,
    noteModeRef,
    noteStore,
    noteStoreRef,
    subSelRef,
    setSubSel,
    onSubSelChangeRef,
    layoutStore,
    selDragRef,
    selRectRef,
    dragRef,
    scheduleRedraw,
  });

  useKeyboardShortcuts({
    drawingModeRef,
    wallModeRef,
    columnModeRef,
    noteModeRef,
    subSelRef,
    setSubSel,
    onSubSelChangeRef,
    layoutStore,
    scheduleRedraw,
    handleDeleteSubSelected,
  });

  useRackDrawingInteraction({
    canvasRef,
    layoutStore,
    worldAt,
    drawingModeRef,
    rackOrientationRef,
    dragRef,
    cellMapRef,
    rackDomainRef,
    rebuildCellMap,
  });

  useWallDrawingInteraction({
    canvasRef,
    layoutStore,
    worldAt,
    wallModeRef,
    wallStoreRef,
    wallPreviewRef,
    scheduleRedraw,
  });

  useColumnPlacementInteraction({
    canvasRef,
    layoutStore,
    worldAt,
    columnModeRef,
    columnStoreRef,
    scheduleRedraw,
  });

  useNotePlacementInteraction({
    canvasRef,
    layoutStore,
    worldAt,
    noteModeRef,
    noteStoreRef,
    scheduleRedraw,
  });

  useNoteResizeInteraction({
    canvasRef,
    layoutStore,
    camera,
    scheduleRedraw,
  });

  useSelectionInteraction({
    canvasRef,
    layoutStore,
    camera,
    scheduleRedraw,
    worldAt,
    drawingModeRef,
    wallModeRef,
    columnModeRef,
    noteModeRef,
    subSelRef,
    setSubSel,
    onSubSelChangeRef,
    lastClickInfoRef,
    moveDragRef,
    selDragRef,
    selRectRef,
  });

  const handleDeselect = useCallback(() => {
    if (layoutStore) layoutStore.deselectAll();
  }, [layoutStore]);

  const handleDeleteSelected = useCallback(() => {
    if (layoutStore) layoutStore.removeSelected();
  }, [layoutStore]);

  const handleDuplicateSelected = useCallback(() => {
    if (layoutStore && layoutStore.selectionCount() > 0) {
      layoutStore.duplicateSelected();
      scheduleRedraw();
    }
  }, [layoutStore, scheduleRedraw]);

  const handleMoveUp = useCallback(() => {
    if (layoutStore) {
      layoutStore.moveSelectedBy(0, -DEFAULT_FRAME_DEPTH_M);
      scheduleRedraw();
    }
  }, [layoutStore, scheduleRedraw]);

  const handleMoveDown = useCallback(() => {
    if (layoutStore) {
      layoutStore.moveSelectedBy(0, DEFAULT_FRAME_DEPTH_M);
      scheduleRedraw();
    }
  }, [layoutStore, scheduleRedraw]);

  const handleMoveLeft = useCallback(() => {
    if (layoutStore) {
      layoutStore.moveSelectedBy(-BAY_STEP_M, 0);
      scheduleRedraw();
    }
  }, [layoutStore, scheduleRedraw]);

  const handleMoveRight = useCallback(() => {
    if (layoutStore) {
      layoutStore.moveSelectedBy(BAY_STEP_M, 0);
      scheduleRedraw();
    }
  }, [layoutStore, scheduleRedraw]);

  const hasSelection = layoutStore ? layoutStore.selectionCount() > 0 : false;
  const theme = getOverlayTheme(isDark);

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          cursor: (drawingMode || wallMode || columnMode || noteMode) ? 'cell' : 'crosshair',
          touchAction: 'none',
        }}
      />

      <CanvasActionsBar
        subSel={subSel}
        hasSelection={hasSelection}
        theme={theme}
        clearSubSel={clearSubSel}
        handleDeleteSubSelected={handleDeleteSubSelected}
        handleDeselect={handleDeselect}
        handleMoveUp={handleMoveUp}
        handleMoveDown={handleMoveDown}
        handleMoveLeft={handleMoveLeft}
        handleMoveRight={handleMoveRight}
        handleDuplicateSelected={handleDuplicateSelected}
        handleDeleteSelected={handleDeleteSelected}
      />

      <CanvasModeBanners
        drawingMode={drawingMode}
        wallMode={wallMode}
        columnMode={columnMode}
        noteMode={noteMode}
        subSel={subSel}
        darkMode={isDark}
        theme={theme}
      />

      <CanvasDrawingToolbar
        drawingMode={drawingMode}
        onToggleDrawingMode={onToggleDrawingMode}
        wallMode={wallMode}
        onSetWallMode={onSetWallMode}
        columnMode={columnMode}
        onToggleColumnMode={onToggleColumnMode}
        noteMode={noteMode}
        onToggleNoteMode={onToggleNoteMode}
        darkMode={isDark}
        disabled={!!subSel}
      />

      <CanvasHUDs
        cursorCoord={cursorCoord}
        zoomPercent={zoomPercent}
        showMeasurements={showMeasurements}
        darkMode={isDark}
        theme={theme}
        onToggleMeasurements={onToggleMeasurements}
        onToggleDarkMode={toggleTheme}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
      />
    </div>
  );
}
