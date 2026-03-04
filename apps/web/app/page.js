'use client';

import { useState, useEffect, useCallback } from 'react';
import EditorPanel from './components/EditorPanel';
import CADCanvas from './components/CADCanvas';
import useLayoutStore from './hooks/useLayoutStore';

export default function HomePage() {
  const [drawingMode, setDrawingMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { store, version } = useLayoutStore();

  const toggleDrawingMode = useCallback(() => {
    setDrawingMode((prev) => !prev);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  // Escape exits drawing mode
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawingMode(false);
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
      />
      <CADCanvas
        drawingMode={drawingMode}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        layoutStore={store}
        layoutVersion={version}
      />
    </div>
  );
}
