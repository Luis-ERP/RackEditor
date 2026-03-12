'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, XCircle, Trash2, Copy, Moon, Sun, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import DrawingToolbar from './DrawingToolbar';

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
  createWallEntity,
  createColumnEntity,
  bresenhamLine,
  paintAllEntities,
  paintSelectionRect as paintSelRect,
  paintWallPreview,
  snapPointToGrid,
} from '../services/layout';

import { buildRackModule } from '../services/rack';

import {
  DEFAULT_FRAME_SPEC,
  DEFAULT_BEAM_SPEC,
  DEFAULT_HOLE_INDICES,
  DEFAULT_BAY_WIDTH_M,
  DEFAULT_FRAME_DEPTH_M,
  BAY_STEP_M,
} from '../services/rack/catalog.js';

// ─────────────────────────────────────────────────────────────────────────────
export default function CADCanvas(props) {
  const {
    drawingMode = false,
    darkMode = false,
    onToggleDarkMode,
    layoutStore,          // LayoutStore instance (from useLayoutStore)
    layoutVersion,        // numeric tick — triggers re-render on store changes
    rackOrientation = 'horizontal',
    wallMode = null,      // null | 'line' | 'rect'
    wallStore = null,     // WallStore instance (from useWallStore)
    columnMode = false,   // true when placing columns
    columnStore = null,   // ColumnStore instance (from useColumnStore)
    onToggleDrawingMode,  // toggle rack drawing mode
    onSetWallMode,        // set wall mode ('rect' | 'line')
    onToggleColumnMode,   // toggle column placement mode
    // rackDomainRef is accessed via props below
  } = props;
  const wrapperRef = useRef(null);
  const canvasRef  = useRef(null);
  const camera     = useRef({ x: 0, y: 0, zoom: 1 });
  const rafId      = useRef(null);
  const needsInit  = useRef(true);
  const sizeRef    = useRef({ w: 0, h: 0 });
  const baseZoom   = useRef(1);   // zoom that equals 100 % (set on first resize)
  const darkRef    = useRef(darkMode);

  const [zoomPercent, setZoomPercent] = useState(100);
  const [cursorCoord, setCursorCoord] = useState({ x: '0 m', y: '0 m' });

  // ── drawing-mode refs (perf / no stale closures) ──────────────
  const drawingModeRef    = useRef(drawingMode);
  const rackOrientationRef = useRef(rackOrientation);
  const dragRef        = useRef({ active: false, lastCell: null });

  // ── wall mode refs ────────────────────────────────────────────
  const wallModeRef     = useRef(wallMode);
  const wallStoreRef    = useRef(wallStore);
  const wallPreviewRef  = useRef(null);

  // ── column mode refs ──────────────────────────────────────────
  const columnModeRef   = useRef(columnMode);
  const columnStoreRef  = useRef(columnStore);

  // ── selection-drag refs ───────────────────────────────────────
  const selDragRef = useRef(null);    // { sx, sy, ex, ey } screen coords
  const selRectRef = useRef(null);    // { x, y, w, h } for painting

  // ── move-drag refs ────────────────────────────────────────────
  const moveDragRef = useRef(null);   // { startWX, startWY } world coords

  // ── cell → entity tracking (for adjacent-bay merging) ─────────
  const cellMapRef = useRef(new Map()); // cellKey → { entityId, domainId }

  // ── rack domain registry ──────────────────────────────────────
  // Passed from parent; maps domainId → RackModule (domain object)
  // (if not provided, create a local fallback)
  const localDomainRef = useRef(new Map());
  const rackDomainRef = props.rackDomainRef || localDomainRef;

  // ── sub-selection: double-click a multi-bay module to target one bay ──
  const subSelRef        = useRef(null);   // { entityId, bayIndex, bayCount, vert }
  const [subSel, setSubSel] = useState(null);
  const lastClickInfoRef = useRef(null);   // { entityId, time } for double-click detection
  const onSubSelChangeRef = useRef(props.onSubSelChange);

  const roundMetric = useCallback((value) => Number(value.toFixed(3)), []);

  const describeEntitySemantics = useCallback((entity, selected = false) => {
    const base = {
      id: entity.id,
      type: entity.type,
      semanticRole: entity.type.toLowerCase(),
      label: entity.label || null,
      selected,
      visible: entity.visible,
      locked: entity.locked,
      positionM: {
        x: roundMetric(entity.transform.x),
        y: roundMetric(entity.transform.y),
      },
      rotationDeg: roundMetric(entity.transform.rotation),
    };

    switch (entity.type) {
      case 'RACK_MODULE':
      case 'RACK_LINE': {
        const domain = rackDomainRef.current.get(entity.domainId);
        const firstBay = domain?.bays?.[0] ?? null;
        return {
          ...base,
          semanticRole: entity.type === 'RACK_MODULE' ? 'rack-module' : 'rack-line',
          domainId: entity.domainId,
          bayCount: entity.bayCount ?? domain?.bays?.length ?? domain?.totalBayCount ?? null,
          widthM: roundMetric(entity.widthM),
          depthM: roundMetric(entity.depthM),
          orientation: entity.transform.rotation === 90 ? 'vertical' : 'horizontal',
          rack: domain ? {
            id: domain.id,
            frameCount: domain.frameCount ?? domain.totalFrameCount ?? null,
            startFrameIndex: domain.startFrameIndex ?? null,
            endFrameIndex: domain.endFrameIndex ?? null,
            levelCount: domain.levelUnion?.length ?? null,
            rowConfiguration: domain.rowConfiguration ?? null,
            levelMode: domain.levelMode ?? null,
            backToBackConfig: domain.backToBackConfig ?? null,
            accessoryIds: domain.accessoryIds ?? firstBay?.accessoryIds ?? [],
            frameSpec: domain.frameSpec ? {
              id: domain.frameSpec.id,
              heightIn: domain.frameSpec.heightIn,
              depthIn: domain.frameSpec.depthIn,
              gauge: domain.frameSpec.gauge,
              capacityClass: domain.frameSpec.capacityClass,
              uprightSeries: domain.frameSpec.uprightSeries,
              basePlateType: domain.frameSpec.basePlateType ?? null,
            } : null,
            beamSpec: firstBay?.beamSpec ? {
              id: firstBay.beamSpec.id,
              lengthIn: firstBay.beamSpec.lengthIn,
              capacityLbPair: firstBay.beamSpec.capacityLbPair,
              series: firstBay.beamSpec.series ?? null,
            } : null,
          } : null,
        };
      }
      case 'WALL':
        return {
          ...base,
          semanticRole: 'wall-segment',
          lengthM: roundMetric(entity.lengthM),
          thicknessM: roundMetric(entity.thicknessM),
        };
      case 'COLUMN':
        return {
          ...base,
          semanticRole: 'structural-column',
          widthM: roundMetric(entity.widthM),
          depthM: roundMetric(entity.depthM),
          shape: entity.shape,
        };
      case 'TEXT_NOTE':
        return {
          ...base,
          semanticRole: 'text-note',
          text: entity.text,
          fontSizeM: roundMetric(entity.fontSizeM),
        };
      default:
        return base;
    }
  }, [rackDomainRef, roundMetric]);

  const logDrawnObjectSemantics = useCallback(() => {
    if (!layoutStore) return;
    const selection = layoutStore.getSelection();
    const visibleEntities = layoutStore.getAll().filter((entity) => entity.visible);
    const semantics = visibleEntities.map((entity) => describeEntitySemantics(entity, selection.has(entity.id)));
    console.log('[CADCanvas] Drawn object semantics', semantics);
  }, [describeEntitySemantics, layoutStore]);

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
      paintAllEntities(ctx, layoutStore, cam, dk, subSelRef.current);
      logDrawnObjectSemantics();
    }

    // wall-drawing preview (ghost shape during drag)
    paintWallPreview(ctx, wallPreviewRef.current, cam, dk);

    // selection rectangle overlay
    paintSelRect(ctx, selRectRef.current, dk);

    drawTopRuler(ctx, w, cam, dk);
    drawLeftRuler(ctx, h, cam, dk);
    drawCornerPatch(ctx, dk);
  }, [layoutStore, logDrawnObjectSemantics]);

  // ── animation loop ────────────────────────────────────────────
  const scheduleRedraw = useCallback(() => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      draw();
      setZoomPercent(Math.round((camera.current.zoom / baseZoom.current) * 100));
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
    // Reset to the same ±30 m default view
    camera.current.zoom = Math.min(w - RULER_SIZE, h - RULER_SIZE) / 60;
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
        camera.current.x    = w / 2;
        camera.current.y    = h / 2;
        // Default zoom: show ±30 m from the origin in the tightest axis
        camera.current.zoom = Math.min(w - RULER_SIZE, h - RULER_SIZE) / 60;
        baseZoom.current    = camera.current.zoom;
        needsInit.current   = false;
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

  // ── sync rackOrientation ref ──────────────────────────────────
  useEffect(() => { rackOrientationRef.current = rackOrientation; }, [rackOrientation]);

  // ── sync wallMode / wallStore refs ────────────────────────────
  useEffect(() => { wallStoreRef.current = wallStore; }, [wallStore]);
  useEffect(() => {
    wallModeRef.current = wallMode;
    if (!wallMode) {
      wallPreviewRef.current = null;
      scheduleRedraw();
    }
    // entering wall mode clears selection and sub-selection
    if (wallMode && layoutStore) {
      if (subSelRef.current) { subSelRef.current = null; setSubSel(null); onSubSelChangeRef.current?.(null); }
      layoutStore.deselectAll();
      selDragRef.current = null;
      selRectRef.current = null;
      scheduleRedraw();
    }
  }, [wallMode, scheduleRedraw, layoutStore]);

  // ── sync columnMode / columnStore refs ─────────────────────────
  useEffect(() => { columnStoreRef.current = columnStore; }, [columnStore]);
  useEffect(() => {
    columnModeRef.current = columnMode;
    // entering column mode clears selection and sub-selection
    if (columnMode && layoutStore) {
      if (subSelRef.current) { subSelRef.current = null; setSubSel(null); onSubSelChangeRef.current?.(null); }
      layoutStore.deselectAll();
      selDragRef.current = null;
      selRectRef.current = null;
      scheduleRedraw();
    }
  }, [columnMode, scheduleRedraw, layoutStore]);

  // ── sync drawingMode ref & cancel drag when mode turns off ─
  useEffect(() => {
    drawingModeRef.current = drawingMode;
    if (!drawingMode && dragRef.current.active) {
      dragRef.current = { active: false, lastCell: null };
    }
    // entering drawing mode clears selection and sub-selection
    if (drawingMode && layoutStore) {
      if (subSelRef.current) { subSelRef.current = null; setSubSel(null); onSubSelChangeRef.current?.(null); }
      layoutStore.deselectAll();
      selDragRef.current = null;
      selRectRef.current = null;
      scheduleRedraw();
    }
  }, [drawingMode, scheduleRedraw, layoutStore]);

  // ── ESC to deselect & Cmd/Ctrl+D to duplicate (canvas-level) ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !drawingModeRef.current) {
        // Clear sub-selection first; if none, fall through to deselect all
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
      // Cmd+D / Ctrl+D → duplicate (disabled during sub-selection)
      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (!subSelRef.current && layoutStore && layoutStore.selectionCount() > 0) {
          layoutStore.duplicateSelected();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layoutStore, scheduleRedraw]);

  // ── helper: get world coords under mouse ──────────────────────
  const worldAt = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (sx < RULER_SIZE || sy < RULER_SIZE) return null;
    return screenToWorld(sx, sy, camera.current);
  }, []);

  // ── sync onSubSelChange prop ref ──────────────────────────────
  useEffect(() => { onSubSelChangeRef.current = props.onSubSelChange; }, [props.onSubSelChange]);

  // ── component-level rebuildCellMap (used by fragment + drawing) ─
  const rebuildCellMap = useCallback(() => {
    const cm = cellMapRef.current;
    cm.clear();
    const currentVert = rackOrientationRef.current === 'vertical';
    const ents = layoutStore ? layoutStore.getAllByType('RACK_MODULE') : [];
    for (const ent of ents) {
      const entVert = ent.transform.rotation === 90;
      if (entVert !== currentVert) continue;
      const mod = rackDomainRef.current.get(ent.domainId);
      if (!mod) continue;
      const bayCount = mod.bays.length;
      for (let i = 0; i < bayCount; i++) {
        const wx = entVert ? ent.transform.x : ent.transform.x + i * BAY_STEP_M;
        const wy = entVert ? ent.transform.y + i * BAY_STEP_M : ent.transform.y;
        const ccx = currentVert ? Math.round(wx / DEFAULT_FRAME_DEPTH_M) : Math.round(wx / BAY_STEP_M);
        const ccy = currentVert ? Math.round(wy / BAY_STEP_M) : Math.round(wy / DEFAULT_FRAME_DEPTH_M);
        cm.set(`${ccx},${ccy}`, { entityId: ent.id, domainId: ent.domainId });
      }
    }
  }, [layoutStore]);

  // ── sub-selection helpers ─────────────────────────────────────
  const clearSubSel = useCallback(() => {
    subSelRef.current = null;
    setSubSel(null);
    onSubSelChangeRef.current?.(null);
    scheduleRedraw();
  }, [scheduleRedraw]);

  const fragmentEntity = useCallback((entityId, bayIndex) => {
    if (!layoutStore) return null;
    const ent = layoutStore.get(entityId);
    if (!ent) return null;
    const mod = rackDomainRef.current.get(ent.domainId);
    if (!mod) return null;
    const bayCount = mod.bays.length;
    if (bayIndex < 0 || bayIndex >= bayCount) return null;

    const vert       = ent.transform.rotation === 90;
    const ox         = ent.transform.x;
    const oy         = ent.transform.y;
    const BAY_W      = DEFAULT_BAY_WIDTH_M;
    const growSize   = (n) => (n - 1) * BAY_STEP_M + BAY_W;
    const bayLabel   = (n, v) => {
      const dims = v ? '42" × 96"' : '96" × 42"';
      return n > 1 ? `${n}× ${dims}` : dims;
    };

    const leftCount  = bayIndex;
    const rightCount = bayCount - bayIndex - 1;
    const targetOx   = vert ? ox : ox + bayIndex * BAY_STEP_M;
    const targetOy   = vert ? oy + bayIndex * BAY_STEP_M : oy;
    const rightOx    = vert ? ox : targetOx + BAY_STEP_M;
    const rightOy    = vert ? targetOy + BAY_STEP_M : oy;

    rackDomainRef.current.delete(ent.domainId);

    let leftEntityId   = null;
    let targetEntityId = null;
    let rightEntityId  = null;

    if (leftCount > 0) {
      // Repurpose original entity as left group
      const leftMod = buildRackModule({ frameSpec: DEFAULT_FRAME_SPEC, beamSpec: DEFAULT_BEAM_SPEC, bayCount: leftCount, holeIndices: DEFAULT_HOLE_INDICES });
      rackDomainRef.current.set(leftMod.id, leftMod);
      layoutStore.update(ent.id, {
        domainId: leftMod.id,
        widthM:   vert ? ent.widthM : growSize(leftCount),
        depthM:   vert ? growSize(leftCount) : ent.depthM,
        bayCount: leftCount,
        label:    bayLabel(leftCount, vert),
      });
      leftEntityId = ent.id;

      // Isolated bay → new entity
      const targetMod = buildRackModule({ frameSpec: DEFAULT_FRAME_SPEC, beamSpec: DEFAULT_BEAM_SPEC, bayCount: 1, holeIndices: DEFAULT_HOLE_INDICES });
      rackDomainRef.current.set(targetMod.id, targetMod);
      const targetEnt = layoutStore.add(createRackModuleEntity({
        x: targetOx, y: targetOy, rotation: vert ? 90 : 0,
        domainId: targetMod.id,
        widthM:   vert ? ent.widthM : BAY_W,
        depthM:   vert ? BAY_W : ent.depthM,
        label:    bayLabel(1, vert), bayCount: 1,
      }));
      targetEntityId = targetEnt.id;

    } else {
      // bayIndex === 0: repurpose original entity as isolated bay
      const targetMod = buildRackModule({ frameSpec: DEFAULT_FRAME_SPEC, beamSpec: DEFAULT_BEAM_SPEC, bayCount: 1, holeIndices: DEFAULT_HOLE_INDICES });
      rackDomainRef.current.set(targetMod.id, targetMod);
      layoutStore.update(ent.id, {
        domainId: targetMod.id,
        widthM:   vert ? ent.widthM : BAY_W,
        depthM:   vert ? BAY_W : ent.depthM,
        bayCount: 1,
        label:    bayLabel(1, vert),
      });
      targetEntityId = ent.id;
    }

    if (rightCount > 0) {
      const rightMod = buildRackModule({ frameSpec: DEFAULT_FRAME_SPEC, beamSpec: DEFAULT_BEAM_SPEC, bayCount: rightCount, holeIndices: DEFAULT_HOLE_INDICES });
      rackDomainRef.current.set(rightMod.id, rightMod);
      const rightEnt = layoutStore.add(createRackModuleEntity({
        x: rightOx, y: rightOy, rotation: vert ? 90 : 0,
        domainId: rightMod.id,
        widthM:   vert ? ent.widthM : growSize(rightCount),
        depthM:   vert ? growSize(rightCount) : ent.depthM,
        label:    bayLabel(rightCount, vert), bayCount: rightCount,
      }));
      rightEntityId = rightEnt.id;
    }

    rebuildCellMap();
    return { leftEntityId, targetEntityId, rightEntityId };
  }, [layoutStore, rebuildCellMap]);

  const handleDeleteSubSelected = useCallback(() => {
    const ss = subSelRef.current;
    if (!ss || !layoutStore) return;
    const ent = layoutStore.get(ss.entityId);
    if (!ent) { clearSubSel(); return; }

    const result = fragmentEntity(ss.entityId, ss.bayIndex);
    if (!result) { clearSubSel(); return; }

    const isolatedEnt = layoutStore.get(result.targetEntityId);
    if (isolatedEnt) {
      rackDomainRef.current.delete(isolatedEnt.domainId);
      layoutStore.remove(result.targetEntityId);
    }

    rebuildCellMap();
    clearSubSel();
  }, [layoutStore, fragmentEntity, rebuildCellMap, clearSubSel]);

  // ── stale sub-selection guard: clear if entity changes externally ─
  useEffect(() => {
    if (!subSel || !layoutStore) return;
    const check = () => {
      const ent = layoutStore.get(subSel.entityId);
      if (!ent || (ent.bayCount ?? 1) !== subSel.bayCount) {
        subSelRef.current = null;
        setSubSel(null);
        onSubSelChangeRef.current?.(null);
      }
    };
    return layoutStore.subscribe(check);
  }, [subSel, layoutStore]);

  // ── Delete / Backspace to remove selected or sub-selected ─────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      // Only active in selection mode (no drawing / wall / column mode)
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
  }, [layoutStore, handleDeleteSubSelected]);

  // ── rack drawing interactions (mousedown / move / up) ─────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    // Snap world coords to bay-dimension grid cells.
    // Horizontal: bays extend along X, step = BAY_STEP_M on X, FRAME_DEPTH on Y.
    // Vertical:   bays extend along Y, step = BAY_STEP_M on Y, FRAME_DEPTH on X.
    const BAY_W = DEFAULT_BAY_WIDTH_M;
    const BAY_D = DEFAULT_FRAME_DEPTH_M;

    const toBayCell = (wx, wy) => {
      const vert = rackOrientationRef.current === 'vertical';
      return vert
        ? { x: Math.floor(wx / BAY_D), y: Math.floor(wy / BAY_STEP_M) }
        : { x: Math.floor(wx / BAY_STEP_M), y: Math.floor(wy / BAY_D) };
    };
    const bayCellWorld = (cx, cy) => {
      const vert = rackOrientationRef.current === 'vertical';
      return vert
        ? { x: cx * BAY_D, y: cy * BAY_STEP_M }
        : { x: cx * BAY_STEP_M, y: cy * BAY_D };
    };

    // Track placed cells per drag session to avoid duplicate adds
    const placedCells = new Set();
    const cellKey = (cx, cy) => `${cx},${cy}`;

    /** Label for a rack entity showing bay count and dimensions. */
    const bayLabel = (bayCount, vert) => {
      const dims = vert ? '42" × 96"' : '96" × 42"';
      return bayCount > 1 ? `${bayCount}× ${dims}` : dims;
    };

    /** Compute entity growth-axis size for N bays. */
    const growSize = (n) => (n - 1) * BAY_STEP_M + BAY_W;

    const placeCell = (cx, cy) => {
      const key = cellKey(cx, cy);
      if (placedCells.has(key)) return false;
      const cm = cellMapRef.current;
      if (cm.has(key)) return false;

      const vert = rackOrientationRef.current === 'vertical';
      const w = bayCellWorld(cx, cy);
      const entW = vert ? BAY_D : BAY_W;
      const entD = vert ? BAY_W : BAY_D;

      // Check if the bay footprint centre is already occupied
      if (layoutStore.hitTest(w.x + entW / 2, w.y + entD / 2)) return false;
      placedCells.add(key);

      // Check adjacent cells along the bay growth axis
      const prevKey = vert ? cellKey(cx, cy - 1) : cellKey(cx - 1, cy);
      const nextKey = vert ? cellKey(cx, cy + 1) : cellKey(cx + 1, cy);
      const prevInfo = cm.get(prevKey);
      const nextInfo = cm.get(nextKey);

      // Resolve entities (guard against stale references)
      const prevEnt = prevInfo ? layoutStore.get(prevInfo.entityId) : null;
      const nextEnt = nextInfo ? layoutStore.get(nextInfo.entityId) : null;
      const prevMod = prevEnt ? rackDomainRef.current.get(prevEnt.domainId) : null;
      const nextMod = nextEnt ? rackDomainRef.current.get(nextEnt.domainId) : null;
      const hasPrev = !!(prevEnt && prevMod);
      const hasNext = !!(nextEnt && nextMod);

      /** Extract hole indices from an existing module's levelUnion. */
      const modHoleIndices = (mod) => mod.levelUnion.map((l) => l.holeIndex);

      /** True if two modules share the same frame spec (same depth, height, capacity). */
      const frameSpecsMatch = (a, b) => a.frameSpec.id === b.frameSpec.id;

      if (hasPrev && hasNext && prevInfo.entityId !== nextInfo.entityId) {
        // ── MERGE: new bay bridges two separate entities ──────────
        // Only merge if both racks have identical frame specs; otherwise place independently.
        if (!frameSpecsMatch(prevMod, nextMod)) {
          return false; // Incompatible specs — refuse to place here
        }
        const totalBays = prevMod.bays.length + 1 + nextMod.bays.length;
        const newMod = buildRackModule({
          frameSpec:   prevMod.frameSpec,
          beamSpec:    prevMod.bays[0].beamSpec,
          bayCount:    totalBays,
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

        // Update cellMap: all cells from both old entities + new cell → prevEnt
        const newRef = { entityId: prevEnt.id, domainId: newMod.id };
        for (const [k, v] of cm) {
          if (v.entityId === prevInfo.entityId || v.entityId === nextInfo.entityId) {
            cm.set(k, newRef);
          }
        }
        cm.set(key, newRef);

      } else if (hasPrev) {
        // ── Extend prev entity forward (right / down) ────────────
        const newBayCount = prevMod.bays.length + 1;
        const newMod = buildRackModule({
          frameSpec:   prevMod.frameSpec,
          beamSpec:    prevMod.bays[0].beamSpec,
          bayCount:    newBayCount,
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
        // ── Extend next entity backward (left / up) ──────────────
        const newBayCount = nextMod.bays.length + 1;
        const newMod = buildRackModule({
          frameSpec:   nextMod.frameSpec,
          beamSpec:    nextMod.bays[0].beamSpec,
          bayCount:    newBayCount,
          holeIndices: modHoleIndices(nextMod),
        });
        rackDomainRef.current.delete(nextEnt.domainId);
        rackDomainRef.current.set(newMod.id, newMod);

        const newGrow = growSize(newBayCount);
        // Shift entity origin backward along the growth axis
        layoutStore.moveTo(nextEnt.id,
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
        // ── No adjacent rack → create new single-bay entity ──────
        const rackModule = buildRackModule({
          frameSpec:   DEFAULT_FRAME_SPEC,
          beamSpec:    DEFAULT_BEAM_SPEC,
          bayCount:    1,
          holeIndices: DEFAULT_HOLE_INDICES,
        });
        rackDomainRef.current.set(rackModule.id, rackModule);

        const ent = layoutStore.add(createRackModuleEntity({
          x:        w.x,
          y:        w.y,
          rotation: vert ? 90 : 0,
          domainId: rackModule.id,
          widthM:   entW,
          depthM:   entD,
          label:    bayLabel(1, vert),
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

    canvas.addEventListener('mousedown',  onDown);
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup',    onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [layoutStore, worldAt, rebuildCellMap]);

  // ── wall drawing interactions (mousedown / move / up) ────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    let wallDragStart = null; // { x, y } snapped world coords

    const onDown = (e) => {
      if (!wallModeRef.current || e.button !== 0) return;
      const world = worldAt(e);
      if (!world) return;
      e.preventDefault();
      const snapped = snapPointToGrid(world.x, world.y);
      wallDragStart = snapped;
      wallPreviewRef.current = {
        mode:       wallModeRef.current,
        startX:     snapped.x,
        startY:     snapped.y,
        endX:       snapped.x,
        endY:       snapped.y,
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
        const dx  = endX - startX;
        const dy  = endY - startY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) { scheduleRedraw(); return; }
        const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
        layoutStore.add(createWallEntity({
          x: startX,
          y: startY,
          rotation,
          lengthM:    len,
          thicknessM,
        }));
      } else if (mode === 'rect') {
        const minX = Math.min(startX, endX);
        const minY = Math.min(startY, endY);
        const maxX = Math.max(startX, endX);
        const maxY = Math.max(startY, endY);
        const w = maxX - minX;
        const h = maxY - minY;
        if (w < 0.1 && h < 0.1) { scheduleRedraw(); return; }
        // Create up to 4 walls forming a rectangle
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

    canvas.addEventListener('mousedown',  onDown);
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup',    onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [layoutStore, worldAt, scheduleRedraw]);

  // ── column placement interaction (click to place) ─────────────
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
  }, [layoutStore, worldAt, scheduleRedraw]);

  // ── select mode: click-to-select, rectangle-select, move ──────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    let didMove = false;

    const onDown = (e) => {
      if (drawingModeRef.current || wallModeRef.current || columnModeRef.current || e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (sx < RULER_SIZE || sy < RULER_SIZE) return;
      e.preventDefault();

      const world = screenToWorld(sx, sy, camera.current);

      // Check if clicking on an entity
      const hit = layoutStore.hitTest(world.x, world.y);
      if (hit) {
        const now  = Date.now();
        const last = lastClickInfoRef.current;
        const isDoubleClick = last && last.entityId === hit.id && now - last.time < 350;

        // Double-click on a multi-bay RACK_MODULE → activate sub-selection
        if (isDoubleClick && hit.type === 'RACK_MODULE' && (hit.bayCount ?? 1) > 1) {
          lastClickInfoRef.current = null;  // prevent triple-click mis-fire
          const vert     = hit.transform.rotation === 90;
          const relCoord = vert ? world.y - hit.transform.y : world.x - hit.transform.x;
          const bayIdx   = Math.max(0, Math.min((hit.bayCount) - 1, Math.floor(relCoord / BAY_STEP_M)));
          const newSubSel = { entityId: hit.id, bayIndex: bayIdx, bayCount: hit.bayCount, vert };
          subSelRef.current = newSubSel;
          setSubSel(newSubSel);
          onSubSelChangeRef.current?.(newSubSel);
          layoutStore.deselectAll();
          scheduleRedraw();
          return;
        }

        // Single click: clear any active sub-selection
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
        // Start entity move drag
        moveDragRef.current = { startWX: world.x, startWY: world.y };
        didMove = false;
        return;
      }

      // No entity hit → clear sub-selection + start rectangle selection
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
      }, true);

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

  const handleDuplicateSelected = useCallback(() => {
    if (layoutStore && layoutStore.selectionCount() > 0) {
      layoutStore.duplicateSelected();
      scheduleRedraw();
    }
  }, [layoutStore, scheduleRedraw]);

  const handleMoveUp = useCallback(() => {
    if (layoutStore) { layoutStore.moveSelectedBy(0, -DEFAULT_FRAME_DEPTH_M); scheduleRedraw(); }
  }, [layoutStore, scheduleRedraw]);

  const handleMoveDown = useCallback(() => {
    if (layoutStore) { layoutStore.moveSelectedBy(0, DEFAULT_FRAME_DEPTH_M); scheduleRedraw(); }
  }, [layoutStore, scheduleRedraw]);

  const handleMoveLeft = useCallback(() => {
    if (layoutStore) { layoutStore.moveSelectedBy(-BAY_STEP_M, 0); scheduleRedraw(); }
  }, [layoutStore, scheduleRedraw]);

  const handleMoveRight = useCallback(() => {
    if (layoutStore) { layoutStore.moveSelectedBy(BAY_STEP_M, 0); scheduleRedraw(); }
  }, [layoutStore, scheduleRedraw]);

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
          cursor: (drawingMode || wallMode || columnMode) ? 'cell' : 'crosshair',
          touchAction: 'none',
        }}
      />

      {/* ── actions toolbar (upper-right) ── */}
      <div style={{ ...actionsBarStyle, background: overlayBg, borderColor: overlayBorder }}>
        {subSel ? (
          // Sub-selection mode: only deselect + delete bay
          <>
            <button
              onClick={clearSubSel}
              style={{ ...actionBtnStyle, color: overlayText }}
              title="Clear bay sub-selection (Esc)"
            >
              <XCircle size={16} />
            </button>
            <div style={{ ...actionDividerStyle, background: overlayBorder }} />
            <button
              onClick={handleDeleteSubSelected}
              style={{ ...actionBtnStyle, color: overlayAccent }}
              title="Delete this bay"
            >
              <Trash2 size={16} />
            </button>
          </>
        ) : (
          // Normal selection mode
          <>
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
                <button onClick={handleMoveUp}    style={{ ...actionBtnStyle, color: overlayText }} title="Move up one grid unit"><ArrowUp size={16} /></button>
                <button onClick={handleMoveDown}  style={{ ...actionBtnStyle, color: overlayText }} title="Move down one grid unit"><ArrowDown size={16} /></button>
                <button onClick={handleMoveLeft}  style={{ ...actionBtnStyle, color: overlayText }} title="Move left one grid unit"><ArrowLeft size={16} /></button>
                <button onClick={handleMoveRight} style={{ ...actionBtnStyle, color: overlayText }} title="Move right one grid unit"><ArrowRight size={16} /></button>
                <div style={{ ...actionDividerStyle, background: overlayBorder }} />
                <button onClick={handleDuplicateSelected} style={{ ...actionBtnStyle, color: overlayText }} title="Duplicate selected (⌘D / Ctrl+D)"><Copy size={16} /></button>
                <button onClick={handleDeleteSelected}    style={{ ...actionBtnStyle, color: overlayAccent }} title="Delete selected"><Trash2 size={16} /></button>
              </>
            )}
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
      {wallMode && (
        <div style={{
          ...drawBannerStyle,
          background: overlayBanner.bg,
          borderColor: overlayBanner.border,
          color: overlayBanner.color,
        }}>
          Drawing: Wall ({wallMode === 'rect' ? 'Rectangle' : 'Line'})
          {' '}— click &amp; drag to draw · Esc to cancel
        </div>
      )}
      {columnMode && (
        <div style={{
          ...drawBannerStyle,
          background: overlayBanner.bg,
          borderColor: overlayBanner.border,
          color: overlayBanner.color,
        }}>
          Placing: Column — click to place · Esc to cancel
        </div>
      )}
      {subSel && (
        <div style={{
          ...drawBannerStyle,
          background: dk ? 'rgba(127,29,29,0.88)' : 'rgba(254,226,226,0.92)',
          borderColor: '#f87171',
          color: dk ? '#fca5a5' : '#991b1b',
        }}>
          Bay {subSel.bayIndex + 1} of {subSel.bayCount} selected — Delete to remove · Esc to cancel
        </div>
      )}

      {/* ── floating drawing toolbar (bottom-centre, Figma-style) ── */}
      <DrawingToolbar
        drawingMode={drawingMode}
        onToggleDrawingMode={onToggleDrawingMode}
        wallMode={wallMode}
        onSetWallMode={onSetWallMode}
        columnMode={columnMode}
        onToggleColumnMode={onToggleColumnMode}
        darkMode={dk}
        disabled={!!subSel}
      />

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
