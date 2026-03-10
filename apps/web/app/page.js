'use client';

import { useState, useEffect, useCallback } from 'react';
import EditorPanel from './components/EditorPanel';
import CADCanvas from './components/CADCanvas';
import useLayoutStore from './hooks/useLayoutStore';
import useWallStore from './hooks/useWallStore';
import useColumnStore from './hooks/useColumnStore';

export default function HomePage() {
  const [drawingMode, setDrawingMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [rackOrientation, setRackOrientation] = useState('horizontal');
  const [wallMode, setWallMode] = useState(null); // null | 'line' | 'rect'
  const [columnMode, setColumnMode] = useState(false);
  const { store, version } = useLayoutStore();
  const { store: wallSt, version: wallVer } = useWallStore();
  const { store: colSt, version: colVer } = useColumnStore();

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
        onToggleDrawingMode={toggleDrawingMode}
        darkMode={darkMode}
        layoutStore={store}
        layoutVersion={version}
        rackOrientation={rackOrientation}
        onToggleOrientation={() => setRackOrientation((o) => o === 'horizontal' ? 'vertical' : 'horizontal')}
        wallMode={wallMode}
        onSetWallMode={handleSetWallMode}
        wallStore={wallSt}
        wallStoreVersion={wallVer}
        columnMode={columnMode}
        onToggleColumnMode={handleToggleColumnMode}
        columnStore={colSt}
        columnStoreVersion={colVer}
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
      />
    </div>
  );
}
