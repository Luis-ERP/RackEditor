'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, XCircle, Trash2, Moon, Sun } from 'lucide-react';

import {
  MIN_ZOOM,
  MAX_ZOOM,
  RULER_SIZE,
  screenToWorld,
  formatWorldValue,
  zoomToward,
} from '../services/coordinateSystem';

import { drawGrid }                                      from '../services/gridRenderer';
import { drawTopRuler, drawLeftRuler, drawCornerPatch }  from '../services/rulerRenderer';

import {
  createRackModuleEntity,
  worldToCell,
  cellToWorld,
  bresenhamLine,
  CELL_SIZE,
  paintAllEntities,
  paintSelectionRect as paintSelRect,
} from '../services/layout';

// ─────────────────────────────────────────────────────────────────────────────
export default function CADCanvas({
  drawingMode = false,
  darkMode = false,
  onToggleDarkMode,
  layoutStore,        // LayoutStore instance (from useLayoutStore)
  layoutVersion,      // numeric tick — triggers re-render on store changes
}) {
  const wrapperRef = useRef(null);
  const canvasRef  = useRef(null);
  const camera     = useRef({ x: 0, y: 0, zoom: 1 });
  const rafId      = useRef(null);
  const needsInit  = useRef(true);
  const sizeRef    = useRef({ w: 0, h: 0 });
  const darkRef    = useRef(darkMode);

  const [zoomPercent, setZoomPercent] = useState(100);
  const [cursorCoord, setCursorCoord] = useState({ x: '0 m', y: '0 m' });

  // ── drawing-mode refs (perf / no stale closures) ──────────────
  const drawingModeRef = useRef(drawingMode);
  const dragRef        = useRef({ active: false, lastCell: null });

  // ── selection-drag refs ───────────────────────────────────────
  const selDragRef = useRef(null);    // { sx, sy, ex, ey } screen coords
  const selRectRef = useRef(null);    // { x, y, w, h } for painting

  // ── move-drag refs ────────────────────────────────────────────
  const moveDragRef = useRef(null);   // { startWX, startWY } world coords

  // ── draw (reads entities from the store) ─────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = sizeRef.current;
    const cam = camera.current;
    const dk = darkRef.current;

    drawGrid(ctx, w, h, cam, dk);

    // paint all layout entities via the central store + renderers
    if (layoutStore) {
      paintAllEntities(ctx, layoutStore, cam, dk);
    }

    // selection rectangle overlay
    paintSelRect(ctx, selRectRef.current, dk);

    drawTopRuler(ctx, w, cam, dk);
    drawLeftRuler(ctx, h, cam, dk);
    drawCornerPatch(ctx, dk);
  }, [layoutStore]);

  // ── animation loop ────────────────────────────────────────────
  const scheduleRedraw = useCallback(() => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      draw();
      setZoomPercent(Math.round(camera.current.zoom * 100));
    });
  }, [draw]);

  // ── redraw when store version changes ─────────────────────────
  useEffect(() => { scheduleRedraw(); }, [layoutVersion, scheduleRedraw]);

  // ── toolbar zoom helpers ──────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    const { w, h } = sizeRef.current;
    zoomToward(camera.current, camera.current.zoom * 1.3, w / 2, h / 2);
    scheduleRedraw();
  }, [scheduleRedraw]);

  const handleZoomOut = useCallback(() => {
    const { w, h } = sizeRef.current;
    zoomToward(camera.current, camera.current.zoom / 1.3, w / 2, h / 2);
    scheduleRedraw();
  }, [scheduleRedraw]);

  const handleFitView = useCallback(() => {
    const { w, h } = sizeRef.current;
    camera.current.x    = w / 2;
    camera.current.y    = h / 2;
    camera.current.zoom = 1;
    scheduleRedraw();
  }, [scheduleRedraw]);

  // ── resize handling (uses ResizeObserver on wrapper) ──────────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas  = canvasRef.current;
    if (!wrapper || !canvas) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const w    = rect.width;
      const h    = rect.height;
      const dpr  = window.devicePixelRatio || 1;

      sizeRef.current = { w, h };
      canvas.width    = w * dpr;
      canvas.height   = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext('2d').scale(dpr, dpr);

      if (needsInit.current) {
        camera.current.x  = w / 2;
        camera.current.y  = h / 2;
        needsInit.current = false;
      }
      scheduleRedraw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [scheduleRedraw]);

  // ── wheel / pinch ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const cam = camera.current;

      if (e.ctrlKey) {
        const factor  = Math.exp(-e.deltaY * 0.008);
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
        const rect    = canvas.getBoundingClientRect();
        zoomToward(cam, newZoom, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        cam.x -= e.deltaX;
        cam.y -= e.deltaY;
      }
      scheduleRedraw();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [scheduleRedraw]);

  // ── sync darkMode ref & redraw ────────────────────────────
  useEffect(() => {
    darkRef.current = darkMode;
    scheduleRedraw();
  }, [darkMode, scheduleRedraw]);

  // ── sync drawingMode ref & cancel drag when mode turns off ─
  useEffect(() => {
    drawingModeRef.current = drawingMode;
    if (!drawingMode && dragRef.current.active) {
      dragRef.current = { active: false, lastCell: null };
    }
    // entering drawing mode clears selection
    if (drawingMode && layoutStore) {
      layoutStore.deselectAll();
      selDragRef.current = null;
      selRectRef.current = null;
      scheduleRedraw();
    }
  }, [drawingMode, scheduleRedraw, layoutStore]);

  // ── ESC to deselect (canvas-level) ────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !drawingModeRef.current && layoutStore) {
        if (layoutStore.selectionCount() > 0) {
          layoutStore.deselectAll();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layoutStore]);

  // ── helper: get world coords under mouse ──────────────────────
  const worldAt = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (sx < RULER_SIZE || sy < RULER_SIZE) return null;
    return screenToWorld(sx, sy, camera.current);
  }, []);

  // ── rack drawing interactions (mousedown / move / up) ─────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    // Track placed cells per drag session to avoid duplicate adds
    const placedCells = new Set();
    const cellKey = (cx, cy) => `${cx},${cy}`;

    const placeCell = (cx, cy) => {
      const key = cellKey(cx, cy);
      if (placedCells.has(key)) return false;
      // Check if already occupied by an existing entity
      const w = cellToWorld(cx, cy);
      const hit = layoutStore.hitTest(w.x + CELL_SIZE / 2, w.y + CELL_SIZE / 2);
      if (hit) return false;
      placedCells.add(key);
      layoutStore.add(createRackModuleEntity({
        x: w.x,
        y: w.y,
        domainId: '',       // no domain binding yet
        widthM: CELL_SIZE,
        depthM: CELL_SIZE,
        label: '',
      }));
      return true;
    };

    const onDown = (e) => {
      if (!drawingModeRef.current || e.button !== 0) return;
      const world = worldAt(e);
      if (!world) return;
      e.preventDefault();
      const cell = worldToCell(world.x, world.y);
      placeCell(cell.x, cell.y);
      dragRef.current = { active: true, lastCell: cell };
    };

    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const world = worldAt(e);
      if (!world) return;
      const cell = worldToCell(world.x, world.y);
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

    canvas.addEventListener('mousedown',  onDown);
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup',    onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [layoutStore, worldAt]);

  // ── select mode: click-to-select, rectangle-select, move ──────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    let didMove = false;

    const onDown = (e) => {
      if (drawingModeRef.current || e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (sx < RULER_SIZE || sy < RULER_SIZE) return;
      e.preventDefault();

      const world = screenToWorld(sx, sy, camera.current);

      // Check if clicking on an entity
      const hit = layoutStore.hitTest(world.x, world.y);
      if (hit) {
        if (e.shiftKey) {
          layoutStore.toggleSelect(hit.id);
        } else if (!layoutStore.isSelected(hit.id)) {
          layoutStore.select(hit.id);
        }
        // Start entity move drag
        moveDragRef.current = { startWX: world.x, startWY: world.y };
        didMove = false;
        return;
      }

      // No entity hit → start rectangle selection
      if (!e.shiftKey) layoutStore.deselectAll();
      selDragRef.current = { sx, sy, ex: sx, ey: sy };
      selRectRef.current = null;
    };

    const onMove = (e) => {
      // Entity move drag
      if (moveDragRef.current) {
        const world = worldAt(e);
        if (!world) return;
        const dx = world.x - moveDragRef.current.startWX;
        const dy = world.y - moveDragRef.current.startWY;
        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
          layoutStore.moveSelectedBy(dx, dy);
          moveDragRef.current.startWX = world.x;
          moveDragRef.current.startWY = world.y;
          didMove = true;
        }
        return;
      }

      // Rectangle selection drag
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
      // Finish entity move
      if (moveDragRef.current) {
        moveDragRef.current = null;
        return;
      }

      // Finish rectangle selection
      if (!selDragRef.current) return;
      const { sx: x0, sy: y0, ex: x1, ey: y1 } = selDragRef.current;
      selDragRef.current = null;
      selRectRef.current = null;

      const cam = camera.current;
      const wA = screenToWorld(Math.min(x0, x1), Math.min(y0, y1), cam);
      const wB = screenToWorld(Math.max(x0, x1), Math.max(y0, y1), cam);

      layoutStore.selectByRect({
        minX: wA.x, minY: wA.y, maxX: wB.x, maxY: wB.y,
      });

      scheduleRedraw();
    };

    canvas.addEventListener('mousedown',  onDown);
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup',    onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [layoutStore, scheduleRedraw, worldAt]);

  // ── mouse move → cursor coordinate HUD ───────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx   = e.clientX - rect.left;
      const sy   = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, camera.current);
      setCursorCoord({
        x: formatWorldValue(world.x),
        y: formatWorldValue(world.y),
      });
    };

    canvas.addEventListener('mousemove', onMouseMove);
    return () => canvas.removeEventListener('mousemove', onMouseMove);
  }, []);

  // ── action helpers ──────────────────────────────────────────
  const handleDeselect = useCallback(() => {
    if (layoutStore) layoutStore.deselectAll();
  }, [layoutStore]);

  const handleDeleteSelected = useCallback(() => {
    if (layoutStore) layoutStore.removeSelected();
  }, [layoutStore]);

  const hasSelection = layoutStore ? layoutStore.selectionCount() > 0 : false;
  // ── dark-mode-aware style helpers ─────────────────────────
  const dk = darkMode;
  const overlayBg     = dk ? 'rgba(30,31,34,0.88)' : 'rgba(255,255,255,0.85)';
  const overlayBorder = dk ? '#374151' : '#e5e7eb';
  const overlayText   = dk ? '#e5e7eb' : '#374151';
  const overlayMuted  = dk ? '#6b7280' : '#d1d5db';
  const overlayZoomTx = dk ? '#d1d5db' : '#4b5563';
  const overlayAccent = dk ? '#dc2626' : '#dc2626';
  const overlayBanner = dk
    ? { bg: 'rgba(30,58,95,0.92)', border: '#3b82f6', color: '#93c5fd' }
    : { bg: 'rgba(219,234,254,0.92)', border: '#93c5fd', color: '#1d4ed8' };
  // ── render ────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          cursor: drawingMode ? 'cell' : 'crosshair',
          touchAction: 'none',
        }}
      />

      {/* ── actions toolbar (upper-right) ── */}
      <div style={{ ...actionsBarStyle, background: overlayBg, borderColor: overlayBorder }}>
        <button
          onClick={handleDeselect}
          style={{ ...actionBtnStyle, color: overlayText }}
          title="Deselect all (Esc)"
        >
          <XCircle size={16} />
        </button>
        {hasSelection && (
          <>
            <div style={{ ...actionDividerStyle, background: overlayBorder }} />
            <button
              onClick={handleDeleteSelected}
              style={{ ...actionBtnStyle, color: overlayAccent }}
              title="Delete selected"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      {/* ── drawing-mode banner ── */}
      {drawingMode && (
        <div style={{
          ...drawBannerStyle,
          background: overlayBanner.bg,
          borderColor: overlayBanner.border,
          color: overlayBanner.color,
        }}>
          Drawing: Rack — click &amp; drag to place · Esc to cancel
        </div>
      )}

      {/* ── cursor coordinate HUD (bottom-left of canvas area) ── */}
      <div style={{
        ...coordHudStyle,
        background: overlayBg,
        borderColor: overlayBorder,
        color: overlayText,
      }}>
        <span>X&nbsp;{cursorCoord.x}</span>
        <span style={{ color: overlayMuted }}>|</span>
        <span>Y&nbsp;{cursorCoord.y}</span>
      </div>

      {/* ── floating zoom toolbar (bottom-right of canvas area) ── */}
      <div style={toolbarWrapperStyle}>
        <span style={{
          ...zoomLabelStyle,
          background: overlayBg,
          borderColor: overlayBorder,
          color: overlayZoomTx,
        }}>{zoomPercent}%</span>
        <div style={{
          ...toolbarStyle,
          background: overlayBg,
          borderColor: overlayBorder,
        }}>
          <button onClick={handleZoomIn}  style={{ ...btnStyle, color: overlayText }} title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button onClick={handleZoomOut} style={{ ...btnStyle, color: overlayText }} title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <div style={{ ...dividerStyle, background: overlayBorder }} />
          <button onClick={handleFitView} style={{ ...btnStyle, color: overlayText }} title="Reset zoom (100%)">
            <Maximize size={16} />
          </button>
          <div style={{ ...dividerStyle, background: overlayBorder }} />
          <button
            onClick={onToggleDarkMode}
            style={{ ...btnStyle, color: overlayText }}
            title={dk ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dk ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── inline styles ──────────────────────────────────────────────
const wrapperStyle = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
  height: '100%',
  overflow: 'hidden',
};

const coordHudStyle = {
  position: 'absolute',
  bottom: 16,
  left: RULER_SIZE + 8,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  fontFamily: 'monospace',
  fontWeight: 500,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 6,
  padding: '4px 10px',
  userSelect: 'none',
  pointerEvents: 'none',
  zIndex: 10,
};

const toolbarWrapperStyle = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  zIndex: 10,
  pointerEvents: 'auto',
};

const zoomLabelStyle = {
  fontSize: 12,
  fontWeight: 500,
  backdropFilter: 'blur(6px)',
  borderRadius: 6,
  padding: '4px 8px',
  minWidth: 48,
  textAlign: 'center',
  userSelect: 'none',
  border: '1px solid',
};

const toolbarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 8,
  padding: '4px 4px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const btnStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  borderRadius: 6,
  cursor: 'pointer',
};

const dividerStyle = {
  width: 1,
  height: 16,
  margin: '0 2px',
};

const actionsBarStyle = {
  position: 'absolute',
  top: RULER_SIZE + 8,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 8,
  padding: 4,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  zIndex: 10,
  pointerEvents: 'auto',
};

const actionBtnStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  borderRadius: 6,
  cursor: 'pointer',
};

const actionDividerStyle = {
  height: 1,
  margin: '0 2px',
};

const drawBannerStyle = {
  position: 'absolute',
  top: RULER_SIZE + 8,
  left: '50%',
  transform: 'translateX(-50%)',
  fontSize: 12,
  fontWeight: 500,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 6,
  padding: '5px 14px',
  userSelect: 'none',
  pointerEvents: 'none',
  zIndex: 10,
  whiteSpace: 'nowrap',
};
