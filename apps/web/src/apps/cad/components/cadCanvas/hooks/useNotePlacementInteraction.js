import { useEffect } from 'react';
import { createTextNoteEntity } from '../../../services/layout';

export default function useNotePlacementInteraction({
  canvasRef,
  layoutStore,
  worldAt,
  noteModeRef,
  noteStoreRef,
  scheduleRedraw,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutStore) return;

    const onDown = (e) => {
      if (!noteModeRef.current || e.button !== 0) return;
      const world = worldAt(e);
      if (!world) return;

      e.preventDefault();
      const ns = noteStoreRef.current;
      const bgColor   = ns ? ns.getDefaultBgColor()   : '#fffde7';
      const fontColor = ns ? ns.getDefaultFontColor() : '#1f2937';
      const fontSizeM = ns ? ns.getDefaultFontSizeM() : 0.3;
      const widthM    = ns ? ns.getDefaultWidthM()    : 2;
      const heightM   = ns ? ns.getDefaultHeightM()   : 1;

      const ent = createTextNoteEntity({
        x: world.x,
        y: world.y,
        text: 'Note',
        fontSizeM,
        widthM,
        heightM,
        bgColor,
        fontColor,
      });

      layoutStore.add(ent);
      scheduleRedraw();
    };

    canvas.addEventListener('mousedown', onDown);
    return () => canvas.removeEventListener('mousedown', onDown);
  }, [canvasRef, noteModeRef, noteStoreRef, layoutStore, scheduleRedraw, worldAt]);
}
