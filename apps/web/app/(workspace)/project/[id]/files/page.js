'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import useProjectRegistry from '@/src/core/project/useProjectRegistry';
import { projectStore } from '@/src/apps/cad/services/project/projectStore';
import {
  exportProjectToFile,
  importProjectFromFile,
  readProject,
} from '@/src/apps/cad/services/project/projectStorage';
import useLayoutStore from '@/src/apps/cad/hooks/useLayoutStore';
import { downloadDrawingImage } from '@/src/apps/cad/services/export/imageExporter';
import { downloadDrawingPDF } from '@/src/apps/cad/services/export/pdfExporter';
import { downloadDrawingSVG } from '@/src/apps/cad/services/export/svgExporter';
import { downloadDXF } from '@/src/apps/cad/services/export/dxfExporter';

export default function FilesPage({ params }) {
  const { id: projectId } = params;
  const { projects, updateProject } = useProjectRegistry();
  const project = projects.find((p) => p.id === projectId);
  const projectName = project?.name ?? '';

  const [localName, setLocalName] = useState(projectName);
  const nameRef = useRef(null);
  const { store } = useLayoutStore();

  useEffect(() => { setLocalName(projectName); }, [projectName]);

  const handleRename = useCallback(() => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== projectName) {
      updateProject(projectId, { name: trimmed });
    } else {
      setLocalName(projectName);
    }
  }, [localName, projectName, projectId, updateProject]);

  const handleExportJSON = useCallback(() => {
    const { activeId } = projectStore.getState();
    if (activeId) {
      projectStore.saveActiveProject();
      const fresh = readProject(activeId);
      if (fresh) { exportProjectToFile(fresh); return; }
    }
    const p = readProject(projectId);
    if (p) exportProjectToFile(p);
  }, [projectId]);

  const handleImportJSON = useCallback(() => {
    if (typeof window === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const imported = await importProjectFromFile(file);
        const doOpen = window.confirm(`"${imported.name}" imported. Open it now?`);
        if (doOpen) projectStore.openProject(imported.id);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Failed to import project.');
      }
    });
    input.click();
  }, []);

  const handleExportPNG  = useCallback(async () => { try { await downloadDrawingImage(store, { title: 'Rack Layout', format: 'png'  }); } catch (e) { window.alert(e.message); } }, [store]);
  const handleExportJPEG = useCallback(async () => { try { await downloadDrawingImage(store, { title: 'Rack Layout', format: 'jpeg' }); } catch (e) { window.alert(e.message); } }, [store]);
  const handleExportSVG  = useCallback(async () => { try { await downloadDrawingSVG(store,  { title: 'Rack Layout' }); } catch (e) { window.alert(e.message); } }, [store]);
  const handleExportPDF  = useCallback(async () => { try { await downloadDrawingPDF(store,  { title: 'Rack Layout' }); } catch (e) { window.alert(e.message); } }, [store]);
  const handleExportDXF  = useCallback(async () => { try { await downloadDXF(store); } catch (e) { window.alert(e.message); } }, [store]);

  return (
    <div style={{ padding: 32, maxWidth: 480, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600, color: 'var(--app-text, #111827)' }}>
        Project Files
      </h2>

      {/* Project name */}
      <section style={{ marginBottom: 28 }}>
        <Label>Name</Label>
        <input
          ref={nameRef}
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => { if (e.key === 'Enter') nameRef.current?.blur(); }}
          style={inputStyle}
        />
      </section>

      {/* JSON file operations */}
      <section style={{ marginBottom: 28 }}>
        <Label>File</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ActionButton onClick={handleExportJSON}>Export JSON…</ActionButton>
          <ActionButton onClick={handleImportJSON}>Import JSON…</ActionButton>
        </div>
      </section>

      {/* Drawing exports */}
      <section>
        <Label>Export Drawing</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton onClick={handleExportPNG}  style={{ flex: 1 }}>PNG</ActionButton>
            <ActionButton onClick={handleExportJPEG} style={{ flex: 1 }}>JPEG</ActionButton>
            <ActionButton onClick={handleExportSVG}  style={{ flex: 1 }}>SVG</ActionButton>
          </div>
          <ActionButton onClick={handleExportPDF}>Export PDF…</ActionButton>
          <ActionButton onClick={handleExportDXF}>Export DXF…</ActionButton>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted-text, #9ca3af)' }}>
          Open the Design tab first to load the drawing before exporting.
        </p>
      </section>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: 'var(--muted-text, #9ca3af)', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function ActionButton({ onClick, children, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', padding: '8px 12px',
        borderRadius: 6, fontSize: 13, fontWeight: 400, cursor: 'pointer',
        textAlign: 'left', border: '1px solid var(--surface-border, #e5e7eb)',
        background: 'var(--surface-muted, #f9fafb)',
        color: 'var(--app-text, #374151)', transition: 'opacity 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px',
  borderRadius: 6, fontSize: 13,
  border: '1px solid var(--surface-border, #e5e7eb)',
  background: 'var(--surface-muted, #f9fafb)',
  color: 'var(--app-text, #374151)', outline: 'none',
};
