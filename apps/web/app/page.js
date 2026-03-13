'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import EditorPanel from './components/EditorPanel';
import CADCanvas from './components/CADCanvas';
import useLayoutStore from './hooks/useLayoutStore';
import useWallStore from './hooks/useWallStore';
import useColumnStore from './hooks/useColumnStore';
import {
  cacheProjectDocument,
  downloadProjectDocument,
  importProjectDocumentFromFile,
  loadCachedProjectDocument,
  restoreProjectDocument,
  serializeProjectDocument,
} from './services/export/projectDocumentExporter';

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
  const hydratedFromCacheRef = useRef(false);

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

  const handleExportProjectDocument = useCallback(() => {
    if (typeof window === 'undefined') return;

    const userInput = window.prompt('File name for export:', 'rack-project.json');
    if (userInput === null) return;

    const trimmed = userInput.trim();
    const baseName = trimmed.length > 0 ? trimmed : 'rack-project.json';
    const fileName = baseName.toLowerCase().endsWith('.json') ? baseName : `${baseName}.json`;

    downloadProjectDocument({
      layoutStore: store,
      wallStore: wallSt,
      columnStore: colSt,
      rackDomainRef,
      canvas: {
        darkMode,
        rackOrientation,
        drawingMode,
        wallMode,
        columnMode,
      },
      fileName,
      scopeKey: 'main',
    });
  }, [store, wallSt, colSt, rackDomainRef, darkMode, rackOrientation, drawingMode, wallMode, columnMode]);

  const handleImportProjectDocument = useCallback(() => {
    if (typeof window === 'undefined' || !window.document) return;

    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        await importProjectDocumentFromFile({
          file,
          layoutStore: store,
          wallStore: wallSt,
          columnStore: colSt,
          rackDomainRef,
          onRestoreCanvas: (canvas) => {
            setDarkMode(Boolean(canvas.darkMode));
            setRackOrientation(canvas.rackOrientation ?? 'horizontal');
            setDrawingMode(Boolean(canvas.drawingMode));
            setWallMode(canvas.wallMode ?? null);
            setColumnMode(Boolean(canvas.columnMode));
          },
          scopeKey: 'main',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to import project document.';
        window.alert(msg);
      }
    });

    input.click();
  }, [store, wallSt, colSt, rackDomainRef]);

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

  // Hydrate from local cache once on first mount.
  useEffect(() => {
    if (hydratedFromCacheRef.current) return;

    const cachedDoc = loadCachedProjectDocument('main');
    if (!cachedDoc) {
      hydratedFromCacheRef.current = true;
      return;
    }

    try {
      restoreProjectDocument({
        doc: cachedDoc,
        layoutStore: store,
        wallStore: wallSt,
        columnStore: colSt,
        rackDomainRef,
        onRestoreCanvas: (canvas) => {
          setDarkMode(Boolean(canvas.darkMode));
          setRackOrientation(canvas.rackOrientation ?? 'horizontal');
          setDrawingMode(Boolean(canvas.drawingMode));
          setWallMode(canvas.wallMode ?? null);
          setColumnMode(Boolean(canvas.columnMode));
        },
      });
    } catch {
      // Ignore malformed cache payloads and continue with a clean session.
    } finally {
      hydratedFromCacheRef.current = true;
    }
  }, [store, wallSt, colSt, rackDomainRef]);

  // Auto-save project progress to cache whenever model/canvas state changes.
  useEffect(() => {
    if (!hydratedFromCacheRef.current) return;

    const timerId = window.setTimeout(() => {
      const doc = serializeProjectDocument({
        layoutStore: store,
        wallStore: wallSt,
        columnStore: colSt,
        rackDomainRef,
        canvas: {
          darkMode,
          rackOrientation,
          drawingMode,
          wallMode,
          columnMode,
        },
      });
      cacheProjectDocument(doc, 'main');
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [
    version,
    wallVer,
    colVer,
    darkMode,
    rackOrientation,
    drawingMode,
    wallMode,
    columnMode,
    store,
    wallSt,
    colSt,
    rackDomainRef,
  ]);

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
        onExportProjectDocument={handleExportProjectDocument}
        onImportProjectDocument={handleImportProjectDocument}
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
