import { useEffect, useRef } from 'react';
import { createColumnEntity, snapPointToGrid } from '../../../services/layout';

// ── State machine phases ────────────────────────────────────────────────────
//
//  IDLE        → click → place origin, enter AXIS1
//  AXIS1       → click → place 2nd col, lock Δ1, enter EXTENDING
//  EXTENDING   → click → place next at lastPos+Δ1, stay
//              → shift+click → lock Δ2 from origin, place full 2nd row, enter GRID_2D
//  GRID_2D     → click → add next row (all cols at axis2Count * Δ2 offset)
//              → shift+click → add next col to every row (axis1Count * Δ1 offset)
//
//  Escape or R (while in column mode) resets to IDLE.
// ───────────────────────────────────────────────────────────────────────────

const INIT_STATE = {
  phase: 'IDLE',
  origin: null,
  delta1: null,
  delta2: null,
  lastPos1: null,
  axis1Count: 0,
  axis2Count: 0,
};

export default function useColumnPlacementInteraction({
  canvasRef,
  layoutStore,
  worldAt,
  columnMode,
  columnModeRef,
  columnStoreRef,
  columnGhostRef,
  scheduleRedraw,
  onPhaseChange,
}) {
  const stateRef = useRef({ ...INIT_STATE });

  // Reset the state machine when column mode is turned off from outside.
  useEffect(() => {
    if (!columnMode) {
      stateRef.current = { ...INIT_STATE };
      columnGhostRef.current = null;
      scheduleRedraw();
      onPhaseChange?.('IDLE');
    }
  }, [columnMode, columnGhostRef, onPhaseChange, scheduleRedraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    const dims = () => {
      const cs = columnStoreRef.current;
      return {
        widthM: cs ? cs.getDefaultWidth() : 0.4,
        depthM: cs ? cs.getDefaultDepth() : 0.4,
      };
    };

    const placeAt = (x, y) => {
      const { widthM, depthM } = dims();
      layoutStore.add(createColumnEntity({ x, y, widthM, depthM }));
    };

    const reset = () => {
      stateRef.current = { ...INIT_STATE };
      columnGhostRef.current = null;
      onPhaseChange?.('IDLE');
      scheduleRedraw();
    };

    const onMove = (e) => {
      if (!columnModeRef.current) return;
      const world = worldAt(e);
      if (!world) return;

      const snapped = snapPointToGrid(world.x, world.y);
      const { widthM, depthM } = dims();
      const s = stateRef.current;
      let positions = [];

      if (s.phase === 'IDLE' || s.phase === 'AXIS1') {
        positions = [{ x: snapped.x, y: snapped.y }];

      } else if (s.phase === 'EXTENDING') {
        if (e.shiftKey && s.delta1) {
          // Preview the full second row that shift+click would place.
          const dx = snapped.x - s.origin.x;
          const dy = snapped.y - s.origin.y;
          for (let i = 0; i < s.axis1Count; i++) {
            positions.push({
              x: s.origin.x + i * s.delta1.x + dx,
              y: s.origin.y + i * s.delta1.y + dy,
            });
          }
        } else {
          positions = [{ x: s.lastPos1.x + s.delta1.x, y: s.lastPos1.y + s.delta1.y }];
        }

      } else if (s.phase === 'GRID_2D') {
        if (e.shiftKey) {
          // Preview: next column extension for every existing row.
          for (let j = 0; j < s.axis2Count; j++) {
            positions.push({
              x: s.origin.x + s.axis1Count * s.delta1.x + j * s.delta2.x,
              y: s.origin.y + s.axis1Count * s.delta1.y + j * s.delta2.y,
            });
          }
        } else {
          // Preview: next row across all existing columns.
          for (let i = 0; i < s.axis1Count; i++) {
            positions.push({
              x: s.origin.x + i * s.delta1.x + s.axis2Count * s.delta2.x,
              y: s.origin.y + i * s.delta1.y + s.axis2Count * s.delta2.y,
            });
          }
        }
      }

      columnGhostRef.current = positions.length ? { positions, widthM, depthM } : null;
      scheduleRedraw();
    };

    const onDown = (e) => {
      if (!columnModeRef.current || e.button !== 0) return;
      const world = worldAt(e);
      if (!world) return;
      e.preventDefault();

      const snapped = snapPointToGrid(world.x, world.y);
      const s = stateRef.current;

      if (s.phase === 'IDLE') {
        placeAt(snapped.x, snapped.y);
        stateRef.current = { ...INIT_STATE, phase: 'AXIS1', origin: snapped, axis1Count: 1 };
        onPhaseChange?.('AXIS1');

      } else if (s.phase === 'AXIS1') {
        const dx = snapped.x - s.origin.x;
        const dy = snapped.y - s.origin.y;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return; // same spot
        placeAt(snapped.x, snapped.y);
        stateRef.current = {
          ...s,
          phase: 'EXTENDING',
          delta1: { x: dx, y: dy },
          lastPos1: snapped,
          axis1Count: 2,
        };
        onPhaseChange?.('EXTENDING');

      } else if (s.phase === 'EXTENDING') {
        if (e.shiftKey) {
          const dx = snapped.x - s.origin.x;
          const dy = snapped.y - s.origin.y;
          if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
          const delta2 = { x: dx, y: dy };
          // Place the full second row immediately.
          for (let i = 0; i < s.axis1Count; i++) {
            placeAt(s.origin.x + i * s.delta1.x + dx, s.origin.y + i * s.delta1.y + dy);
          }
          stateRef.current = { ...s, phase: 'GRID_2D', delta2, axis2Count: 2 };
          onPhaseChange?.('GRID_2D');
        } else {
          const next = { x: s.lastPos1.x + s.delta1.x, y: s.lastPos1.y + s.delta1.y };
          placeAt(next.x, next.y);
          stateRef.current = { ...s, lastPos1: next, axis1Count: s.axis1Count + 1 };
        }

      } else if (s.phase === 'GRID_2D') {
        if (e.shiftKey) {
          // Add next column to every existing row.
          for (let j = 0; j < s.axis2Count; j++) {
            placeAt(
              s.origin.x + s.axis1Count * s.delta1.x + j * s.delta2.x,
              s.origin.y + s.axis1Count * s.delta1.y + j * s.delta2.y,
            );
          }
          stateRef.current = { ...s, axis1Count: s.axis1Count + 1 };
        } else {
          // Add next row across all existing columns.
          for (let i = 0; i < s.axis1Count; i++) {
            placeAt(
              s.origin.x + i * s.delta1.x + s.axis2Count * s.delta2.x,
              s.origin.y + i * s.delta1.y + s.axis2Count * s.delta2.y,
            );
          }
          stateRef.current = { ...s, axis2Count: s.axis2Count + 1 };
        }
      }

      scheduleRedraw();
    };

    const onKey = (e) => {
      if (!columnModeRef.current) return;
      if ((e.key === 'Escape' || e.key === 'r' || e.key === 'R') && stateRef.current.phase !== 'IDLE') {
        reset();
      }
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [canvasRef, columnGhostRef, columnModeRef, columnStoreRef, layoutStore, onPhaseChange, scheduleRedraw, worldAt]);
}
