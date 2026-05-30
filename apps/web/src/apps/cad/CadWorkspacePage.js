'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import EditorPanel from './components/EditorPanel';
import CADCanvas from './components/CADCanvas';
import useLayoutStore from './hooks/useLayoutStore';
import useWallStore from './hooks/useWallStore';
import useColumnStore from './hooks/useColumnStore';
import useNoteStore from './hooks/useNoteStore';
import { useAppTheme } from '@/src/shared/theme/AppThemeProvider';
import {
  downloadProjectDocument,
  serializeProjectDocument,
} from './services/export/projectDocumentExporter';
import {
  rackDomainSingleton,
  getCanvasState,
  setCanvasState,
} from './services/cadStores';
import { getQuoteStore } from '@/src/apps/quoter/services/quoteSingleton';
import { deriveBomFromCadProject, buildCatalogResolver } from '@/src/apps/quoter/services/cadImportService';
import { projectStore } from './services/project/projectStore';
import {
  exportProjectToFile,
  importProjectFromFile,
  readProject,
} from './services/project/projectStorage';
import { downloadDrawingImage } from './services/export/imageExporter';
import { downloadDrawingPDF } from './services/export/pdfExporter';
import { downloadDrawingSVG } from './services/export/svgExporter';
import { downloadDXF } from './services/export/dxfExporter';

export default function CadWorkspacePage() {
  const router = useRouter();
  const [drawingMode, setDrawingMode] = useState(() => getCanvasState().drawingMode);
  const [rackOrientation, setRackOrientation] = useState(() => getCanvasState().rackOrientation);
  const [wallMode, setWallMode] = useState(() => getCanvasState().wallMode);
  const [columnMode, setColumnMode] = useState(() => getCanvasState().columnMode);
  const [noteMode, setNoteMode] = useState(() => getCanvasState().noteMode);
  const [showMeasurements, setShowMeasurements] = useState(() => getCanvasState().showMeasurements !== false);
  const [subSel, setSubSel] = useState(null);
  const { isDark, setTheme } = useAppTheme();
  const { store, version } = useLayoutStore();
  const { store: wallSt, version: wallVer } = useWallStore();
  const { store: colSt, version: colVer } = useColumnStore();
  const { store: noteSt, version: noteVer } = useNoteStore();

  // rackDomainRef points to the module-level singleton Map so data persists
  // across route navigations and projectStore can serialize it on auto-save.
  const rackDomainRef = useRef(rackDomainSingleton);

  // ── Canvas-restore event (fired by projectStore.openProject) ─────────────
  useEffect(() => {
    const handler = (e) => {
      const canvas = e.detail;
      if (!canvas) return;
      setTheme(canvas.darkMode ? 'dark' : 'light');
      setRackOrientation(canvas.rackOrientation ?? 'horizontal');
      setDrawingMode(Boolean(canvas.drawingMode));
      setWallMode(canvas.wallMode ?? null);
      setColumnMode(Boolean(canvas.columnMode));
      setNoteMode(Boolean(canvas.noteMode));
      setShowMeasurements(canvas.showMeasurements !== false);
    };
    window.addEventListener('rack-editor:canvas-restore', handler);
    return () => window.removeEventListener('rack-editor:canvas-restore', handler);
  }, [setTheme]);

  // ── Sync canvas React state → canvas singleton (for auto-save) ────────────
  useEffect(() => {
    setCanvasState({
      darkMode: isDark,
      rackOrientation,
      drawingMode,
      wallMode,
      columnMode,
      noteMode,
      showMeasurements,
    });
  }, [isDark, rackOrientation, drawingMode, wallMode, columnMode, noteMode, showMeasurements]);

  // ── Keyboard shortcut: Cmd/Ctrl+S → explicit save ─────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        projectStore.saveActiveProject();
      }
      if (e.key === 'Escape') {
        setDrawingMode(false);
        setWallMode(null);
        setColumnMode(false);
        setNoteMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Mode toggles ──────────────────────────────────────────────────────────

  const toggleDrawingMode = useCallback(() => {
    setDrawingMode((prev) => {
      if (!prev) {
        setWallMode(null);
        setColumnMode(false);
        setNoteMode(false);
      }
      return !prev;
    });
  }, []);

  const handleSetWallMode = useCallback((mode) => {
    setWallMode((prev) => {
      if (prev === mode) return null;
      setDrawingMode(false);
      setColumnMode(false);
      setNoteMode(false);
      return mode;
    });
  }, []);

  const handleToggleColumnMode = useCallback(() => {
    setColumnMode((prev) => {
      if (!prev) {
        setDrawingMode(false);
        setWallMode(null);
        setNoteMode(false);
      }
      return !prev;
    });
  }, []);

  const handleToggleNoteMode = useCallback(() => {
    setNoteMode((prev) => {
      if (!prev) {
        setDrawingMode(false);
        setWallMode(null);
        setColumnMode(false);
      }
      return !prev;
    });
  }, []);

  // ── Export / Import handlers ──────────────────────────────────────────────

  const handleExportProjectDocument = useCallback(() => {
    const { activeId } = projectStore.getState();
    if (activeId) {
      const project = readProject(activeId);
      if (project) {
        // Save current state first so the export is up-to-date
        projectStore.saveActiveProject();
        const fresh = readProject(activeId);
        if (fresh) { exportProjectToFile(fresh); return; }
      }
    }
    // Fallback: export current CAD state as a legacy document
    const userInput = window.prompt('File name for export:', 'rack-project.json');
    if (userInput === null) return;
    const baseName = userInput.trim() || 'rack-project.json';
    const fileName = baseName.toLowerCase().endsWith('.json') ? baseName : `${baseName}.json`;
    downloadProjectDocument({
      layoutStore: store,
      wallStore: wallSt,
      columnStore: colSt,
      rackDomainRef,
      canvas: { darkMode: isDark, rackOrientation, drawingMode, wallMode, columnMode, showMeasurements },
      fileName,
    });
  }, [store, wallSt, colSt, isDark, rackOrientation, drawingMode, wallMode, columnMode, showMeasurements]);

  const handleImportProjectDocument = useCallback(() => {
    if (typeof window === 'undefined' || !window.document) return;
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const imported = await importProjectFromFile(file);
        const doOpen = window.confirm(
          `"${imported.name}" imported successfully. Open it now?`
        );
        if (doOpen) projectStore.openProject(imported.id);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Failed to import project.');
      }
    });
    input.click();
  }, []);

  // ── Send to Quoter (direct store sync — no sessionStorage) ────────────────

  const handleSendToQuoter = useCallback(() => {
    const doc = serializeProjectDocument({
      layoutStore: store,
      wallStore: wallSt,
      columnStore: colSt,
      rackDomainRef,
      canvas: { darkMode: isDark, rackOrientation, drawingMode, wallMode, columnMode, showMeasurements },
    });
    try {
      const bom = deriveBomFromCadProject(doc);
      const resolver = buildCatalogResolver(bom.items);
      getQuoteStore().syncFromBom(bom, {
        resolveCatalog: resolver,
        projectFile: projectStore.getState().activeId ?? 'CAD Project',
      });
    } catch (e) {
      window.alert(`Failed to sync BOM: ${e.message}`);
      return;
    }
    router.push('/quoter');
  }, [store, wallSt, colSt, isDark, rackOrientation, drawingMode, wallMode, columnMode, showMeasurements, router]);

  // ── Drawing export handlers ───────────────────────────────────────────────

  const handleExportPNG = useCallback(async () => {
    try { await downloadDrawingImage(store, { title: 'Rack Layout', format: 'png' }); }
    catch (e) { window.alert(e.message); }
  }, [store]);

  const handleExportJPEG = useCallback(async () => {
    try { await downloadDrawingImage(store, { title: 'Rack Layout', format: 'jpeg' }); }
    catch (e) { window.alert(e.message); }
  }, [store]);

  const handleExportPDF = useCallback(async () => {
    try { await downloadDrawingPDF(store, { title: 'Rack Layout' }); }
    catch (e) { window.alert(e.message); }
  }, [store]);

  const handleExportSVG = useCallback(async () => {
    try { await downloadDrawingSVG(store, { title: 'Rack Layout' }); }
    catch (e) { window.alert(e.message); }
  }, [store]);

  const handleExportDXF = useCallback(() => {
    try { downloadDXF(store); }
    catch (e) { window.alert(e.message); }
  }, [store]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <EditorPanel
        drawingMode={drawingMode}
        darkMode={isDark}
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
        noteMode={noteMode}
        noteStore={noteSt}
        noteStoreVersion={noteVer}
        rackDomainRef={rackDomainRef}
        subSelActive={subSel !== null}
        onExportProjectDocument={handleExportProjectDocument}
        onImportProjectDocument={handleImportProjectDocument}
        onSendToQuoter={handleSendToQuoter}
        onExportPNG={handleExportPNG}
        onExportJPEG={handleExportJPEG}
        onExportPDF={handleExportPDF}
        onExportSVG={handleExportSVG}
        onExportDXF={handleExportDXF}
      />
      <CADCanvas
        drawingMode={drawingMode}
        layoutStore={store}
        layoutVersion={version}
        rackOrientation={rackOrientation}
        wallMode={wallMode}
        wallStore={wallSt}
        columnMode={columnMode}
        columnStore={colSt}
        noteMode={noteMode}
        noteStore={noteSt}
        rackDomainRef={rackDomainRef}
        onSubSelChange={setSubSel}
        showMeasurements={showMeasurements}
        onToggleDrawingMode={toggleDrawingMode}
        onSetWallMode={handleSetWallMode}
        onToggleColumnMode={handleToggleColumnMode}
        onToggleNoteMode={handleToggleNoteMode}
        onToggleMeasurements={() => setShowMeasurements((prev) => !prev)}
      />
    </div>
  );
}
