'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen,
  Plus,
  MoreVertical,
  Download,
  Upload,
  Trash2,
  Copy,
  Edit2,
  X,
  Check,
  HardDrive,
} from 'lucide-react';
import { projectStore } from '@/src/apps/cad/services/project/projectStore';
import useProjectStore from '@/src/apps/cad/services/project/useProjectStore';
import {
  estimateStorageUsage,
  exportProjectToFile,
  importProjectFromFile,
  readProject,
} from '@/src/apps/cad/services/project/projectStorage';

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtRelativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Inline rename input ───────────────────────────────────────────────────────

function RenameInput({ initialValue, onConfirm, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onConfirm(value.trim() || initialValue);
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          padding: '2px 6px',
          border: '1px solid var(--accent)',
          borderRadius: 4,
          background: 'var(--surface)',
          color: 'var(--app-text)',
          fontSize: 14,
          outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={() => onConfirm(value.trim() || initialValue)}
        style={iconBtnStyle}
        title="Confirm rename"
      >
        <Check size={14} />
      </button>
      <button type="button" onClick={onCancel} style={iconBtnStyle} title="Cancel">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const iconBtnStyle = {
  width: 26,
  height: 26,
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid transparent',
  cursor: 'pointer',
  color: 'var(--muted-text)',
  flexShrink: 0,
};

const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--app-text)',
  background: 'none',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

// ── Row action menu ───────────────────────────────────────────────────────────

function RowMenu({ projectId, projectName, isActive, onClose, onRename, onPickerClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handle = (fn) => () => { fn(); onClose(); };

  const handleOpen = () => { projectStore.openProject(projectId); onClose(); onPickerClose(); };

  const handleDuplicate = handle(() => {
    projectStore.duplicateProjectById(projectId);
  });

  const handleExport = handle(() => {
    projectStore.saveActiveProject();
    const p = readProject(projectId);
    if (p) exportProjectToFile(p);
  });

  const handleDelete = handle(() => {
    if (!window.confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    projectStore.deleteProjectById(projectId);
  });

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        right: 4,
        top: '100%',
        zIndex: 100,
        background: 'var(--surface)',
        border: '1px solid var(--surface-border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        minWidth: 160,
        padding: '4px 0',
      }}
    >
      {!isActive && (
        <button type="button" style={menuItemStyle} onClick={handleOpen}>
          <FolderOpen size={14} /> Open
        </button>
      )}
      <button type="button" style={menuItemStyle} onClick={() => { onRename(); onClose(); }}>
        <Edit2 size={14} /> Rename
      </button>
      <button type="button" style={menuItemStyle} onClick={handleDuplicate}>
        <Copy size={14} /> Duplicate
      </button>
      <button type="button" style={menuItemStyle} onClick={handleExport}>
        <Download size={14} /> Export to file
      </button>
      <div style={{ borderTop: '1px solid var(--surface-border)', margin: '4px 0' }} />
      <button
        type="button"
        style={{ ...menuItemStyle, color: 'var(--error, #e53e3e)' }}
        onClick={handleDelete}
      >
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
}

// ── Project row ───────────────────────────────────────────────────────────────

function ProjectRow({ meta, isActive, onClose }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const handleRenameConfirm = (name) => {
    if (name && name !== meta.name) projectStore.renameProject(meta.id, name);
    setRenaming(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        cursor: renaming ? 'default' : 'pointer',
        background: isActive ? 'var(--accent-soft)' : 'transparent',
        border: isActive ? '1px solid var(--surface-border)' : '1px solid transparent',
        position: 'relative',
      }}
      onClick={() => {
        if (!renaming && !menuOpen) {
          projectStore.openProject(meta.id);
          onClose();
        }
      }}
    >
      <FolderOpen
        size={16}
        style={{ color: isActive ? 'var(--app-text)' : 'var(--muted-text)', flexShrink: 0 }}
      />

      {renaming ? (
        <RenameInput
          initialValue={meta.name}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, color: 'var(--app-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-text)' }}>
            {fmtRelativeTime(meta.updatedAt)}
          </div>
        </div>
      )}

      <div
        style={{ position: 'relative', flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          style={iconBtnStyle}
          title="Project actions"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <RowMenu
            projectId={meta.id}
            projectName={meta.name}
            isActive={isActive}
            onClose={() => setMenuOpen(false)}
            onRename={() => setRenaming(true)}
            onPickerClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ── Storage bar ───────────────────────────────────────────────────────────────

function StorageBar() {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    setUsage(estimateStorageUsage());
  }, []);

  if (!usage) return null;

  const pct = Math.min(100, Math.round((usage.usedBytes / usage.totalBytes) * 100));
  const color = pct >= 95 ? '#e53e3e' : pct >= 80 ? '#dd6b20' : 'var(--muted-text)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted-text)' }}>
      <HardDrive size={13} />
      <div style={{ flex: 1, height: 4, background: 'var(--surface-border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, minWidth: 36 }}>{pct}%</span>
      <span>{fmtBytes(usage.usedBytes)}</span>
    </div>
  );
}

// ── Main ProjectPicker ────────────────────────────────────────────────────────

export default function ProjectPicker({ isOpen, onClose }) {
  const { projects, activeId, dirty } = useProjectStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const createInputRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (creating) createInputRef.current?.focus();
  }, [creating]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleCreate = useCallback(() => {
    const name = (newProjectName.trim() || 'New Project');
    projectStore.createProject(name);
    setNewProjectName('');
    setCreating(false);
    onClose();
  }, [newProjectName, onClose]);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const imported = await importProjectFromFile(file);
        projectStore.refreshProjectList();
        const doOpen = window.confirm(`"${imported.name}" imported. Open it?`);
        if (doOpen) { projectStore.openProject(imported.id); onClose(); }
      } catch (err) {
        window.alert(err.message || 'Failed to import project.');
      }
    });
    input.click();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: 12,
          width: 480,
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 12px', borderBottom: '1px solid var(--surface-border)' }}>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--app-text)' }}>
            My Projects
            {dirty && <span style={{ marginLeft: 8, color: 'var(--muted-text)', fontWeight: 400, fontSize: 12 }}>● unsaved</span>}
          </span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              background: 'var(--accent-soft)',
              border: '1px solid var(--surface-border)',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--app-text)',
              marginRight: 8,
            }}
          >
            <Plus size={14} /> New
          </button>
          <button type="button" onClick={onClose} style={{ ...iconBtnStyle, color: 'var(--muted-text)' }}>
            <X size={16} />
          </button>
        </div>

        {/* New project inline form */}
        {creating && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--surface-border)', display: 'flex', gap: 6 }}>
            <input
              ref={createInputRef}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewProjectName(''); }
              }}
              placeholder="Project name..."
              style={{
                flex: 1,
                padding: '5px 8px',
                border: '1px solid var(--accent)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--app-text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleCreate}
              style={{ ...iconBtnStyle, background: 'var(--accent-soft)', border: '1px solid var(--surface-border)', color: 'var(--app-text)' }}
            >
              <Check size={14} />
            </button>
            <button type="button" onClick={() => { setCreating(false); setNewProjectName(''); }} style={iconBtnStyle}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Project list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {projects.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 13 }}>
              No projects yet. Create one to get started.
            </div>
          ) : (
            projects.map((meta) => (
              <ProjectRow
                key={meta.id}
                meta={meta}
                isActive={meta.id === activeId}
                onClose={onClose}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleImport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--surface-border)',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--muted-text)',
            }}
          >
            <Upload size={13} /> Import from file
          </button>
          <div style={{ flex: 1 }}>
            <StorageBar />
          </div>
        </div>
      </div>
    </div>
  );
}
