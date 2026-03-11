'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import EditorPanel from './components/EditorPanel';
import CADCanvas from './components/CADCanvas';
import useLayoutStore from './hooks/useLayoutStore';
import useWallStore from './hooks/useWallStore';
import useColumnStore from './hooks/useColumnStore';
import { downloadDXF } from './services/export/dxfExporter';

export default function HomePage() {
  const [drawingMode, setDrawingMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [rackOrientation, setRackOrientation] = useState('horizontal');
  const [wallMode, setWallMode] = useState(null); // null | 'line' | 'rect'
  const [columnMode, setColumnMode] = useState(false);
  const [subSel, setSubSel] = useState(null);
  const { store, version } = useLayoutStore();
  const { store: wallSt, version: wallVer } = useWallStore();
  const { store: colSt, version: colVer } = useColumnStore();

  // Rack domain registry: shared between canvas (writes) and panel (reads BOM)
  const rackDomainRef = useRef(new Map());

  const toggleDrawingMode = useCallback(() => {
    setDrawingMode((prev) => {
      if (!prev) {
        setWallMode(null);     // entering rack mode exits wall mode
        setColumnMode(false);  // entering rack mode exits column mode
      }
      return !prev;
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const handleExportDXF = useCallback(() => {
    downloadDXF(store, 'rack-layout.dxf');
  }, [store]);

  /** Toggle wall mode (rect or line). Clicking the active mode deactivates it. */
  const handleSetWallMode = useCallback((mode) => {
    setWallMode((prev) => {
      if (prev === mode) return null;            // toggle off
      setDrawingMode(false);                     // exit rack drawing mode
      setColumnMode(false);                      // exit column mode
      return mode;
    });
  }, []);

  /** Toggle column placement mode. */
  const handleToggleColumnMode = useCallback(() => {
    setColumnMode((prev) => {
      if (!prev) {
        setDrawingMode(false);                   // exit rack drawing mode
        setWallMode(null);                       // exit wall mode
      }
      return !prev;
    });
  }, []);

  // Escape exits any active drawing mode
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDrawingMode(false);
        setWallMode(null);
        setColumnMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <EditorPanel
        drawingMode={drawingMode}
        darkMode={darkMode}
        layoutStore={store}
        layoutVersion={version}
        rackOrientation={rackOrientation}
        onToggleOrientation={() => setRackOrientation((o) => o === 'horizontal' ? 'vertical' : 'horizontal')}
        wallMode={wallMode}
        wallStore={wallSt}
        wallStoreVersion={wallVer}
        columnMode={columnMode}
        columnStore={colSt}
        columnStoreVersion={colVer}
        rackDomainRef={rackDomainRef}
        subSelActive={subSel !== null}
      />
      <CADCanvas
        drawingMode={drawingMode}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        layoutStore={store}
        layoutVersion={version}
        rackOrientation={rackOrientation}
        wallMode={wallMode}
        wallStore={wallSt}
        columnMode={columnMode}
        columnStore={colSt}
        rackDomainRef={rackDomainRef}
        onSubSelChange={setSubSel}
        onToggleDrawingMode={toggleDrawingMode}
        onSetWallMode={handleSetWallMode}
        onToggleColumnMode={handleToggleColumnMode}
      />
    </div>
  );
}
