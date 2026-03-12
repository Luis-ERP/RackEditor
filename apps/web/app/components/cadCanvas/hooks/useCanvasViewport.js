import { useCallback, useEffect, useState } from 'react';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  RULER_SIZE,
  screenToWorld,
  formatWorldValue,
  zoomToward,
} from '../../../services/coordinateSystem';
import { drawGrid } from '../../../services/gridRenderer';
import { drawTopRuler, drawLeftRuler, drawCornerPatch } from '../../../services/rulerRenderer';
import { paintAllEntities, paintSelectionRect, paintWallPreview } from '../../../services/layout';
import { logDrawnObjectSemantics } from '../semantics';

export default function useCanvasViewport({
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
}) {
  const [zoomPercent, setZoomPercent] = useState(100);
  const [cursorCoord, setCursorCoord] = useState({ x: '0 m', y: '0 m' });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { w, h } = sizeRef.current;
    const cam = camera.current;
    const dk = darkRef.current;

    drawGrid(ctx, w, h, cam, dk);

    if (layoutStore) {
      paintAllEntities(ctx, layoutStore, cam, dk, subSelRef.current);
      logDrawnObjectSemantics(layoutStore, rackDomainRef);
    }

    paintWallPreview(ctx, wallPreviewRef.current, cam, dk);
    paintSelectionRect(ctx, selRectRef.current, dk);

    drawTopRuler(ctx, w, cam, dk);
    drawLeftRuler(ctx, h, cam, dk);
    drawCornerPatch(ctx, dk);
  }, [camera, canvasRef, darkRef, layoutStore, rackDomainRef, selRectRef, sizeRef, subSelRef, wallPreviewRef]);

  const scheduleRedraw = useCallback(() => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      draw();
      setZoomPercent(Math.round((camera.current.zoom / baseZoom.current) * 100));
    });
  }, [baseZoom, camera, draw, rafId]);

  useEffect(() => {
    scheduleRedraw();
  }, [layoutVersion, scheduleRedraw]);

  const handleZoomIn = useCallback(() => {
    const { w, h } = sizeRef.current;
    zoomToward(camera.current, camera.current.zoom * 1.3, w / 2, h / 2);
    scheduleRedraw();
  }, [camera, scheduleRedraw, sizeRef]);

  const handleZoomOut = useCallback(() => {
    const { w, h } = sizeRef.current;
    zoomToward(camera.current, camera.current.zoom / 1.3, w / 2, h / 2);
    scheduleRedraw();
  }, [camera, scheduleRedraw, sizeRef]);

  const handleFitView = useCallback(() => {
    const { w, h } = sizeRef.current;
    camera.current.x = w / 2;
    camera.current.y = h / 2;
    camera.current.zoom = Math.min(w - RULER_SIZE, h - RULER_SIZE) / 60;
    scheduleRedraw();
  }, [camera, scheduleRedraw, sizeRef]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const dpr = window.devicePixelRatio || 1;

      sizeRef.current = { w, h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext('2d').scale(dpr, dpr);

      if (needsInit.current) {
        camera.current.x = w / 2;
        camera.current.y = h / 2;
        camera.current.zoom = Math.min(w - RULER_SIZE, h - RULER_SIZE) / 60;
        baseZoom.current = camera.current.zoom;
        needsInit.current = false;
      }
      scheduleRedraw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [baseZoom, camera, canvasRef, needsInit, scheduleRedraw, sizeRef, wrapperRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const cam = camera.current;

      if (e.ctrlKey) {
        const factor = Math.exp(-e.deltaY * 0.008);
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
        const rect = canvas.getBoundingClientRect();
        zoomToward(cam, newZoom, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        cam.x -= e.deltaX;
        cam.y -= e.deltaY;
      }
      scheduleRedraw();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [camera, canvasRef, scheduleRedraw]);

  const worldAt = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (sx < RULER_SIZE || sy < RULER_SIZE) return null;
    return screenToWorld(sx, sy, camera.current);
  }, [camera, canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, camera.current);
      setCursorCoord({
        x: formatWorldValue(world.x),
        y: formatWorldValue(world.y),
      });
    };

    canvas.addEventListener('mousemove', onMouseMove);
    return () => canvas.removeEventListener('mousemove', onMouseMove);
  }, [camera, canvasRef]);

  return {
    draw,
    scheduleRedraw,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    zoomPercent,
    cursorCoord,
    worldAt,
  };
}
