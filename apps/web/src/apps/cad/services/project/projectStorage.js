// ─────────────────────────────────────────────────────────────────────────────
//  Project Storage
//
//  Pure localStorage I/O — no React, no store imports.
//  All functions are synchronous (localStorage is synchronous by spec).
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_KEY = 'rack-editor:projects:index';
const ACTIVE_KEY = 'rack-editor:projects:active';
const PROJECT_KEY_PREFIX = 'rack-editor:project:';

export const PROJECT_SCHEMA_VERSION = '2.0.0';

function ls() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

// ── Index management ──────────────────────────────────────────────────────────

export function listProjectIds() {
  const store = ls();
  if (!store) return [];
  try {
    const raw = store.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _saveIndex(ids) {
  const store = ls();
  if (!store) return;
  try { store.setItem(INDEX_KEY, JSON.stringify(ids)); } catch { /* quota */ }
}

// ── Project read/write ────────────────────────────────────────────────────────

export function readProjectMeta(id) {
  const store = ls();
  if (!store) return null;
  try {
    const raw = store.getItem(PROJECT_KEY_PREFIX + id);
    if (!raw) return null;
    const { id: pid, name, createdAt, updatedAt, schemaVersion } = JSON.parse(raw);
    return { id: pid, name, createdAt, updatedAt, schemaVersion };
  } catch {
    return null;
  }
}

export function readProject(id) {
  const store = ls();
  if (!store) return null;
  try {
    const raw = store.getItem(PROJECT_KEY_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeProject(project) {
  const store = ls();
  if (!store) return false;
  try {
    const toWrite = { ...project, updatedAt: new Date().toISOString() };
    store.setItem(PROJECT_KEY_PREFIX + project.id, JSON.stringify(toWrite));
    const ids = listProjectIds();
    if (!ids.includes(project.id)) {
      ids.push(project.id);
      _saveIndex(ids);
    }
    return true;
  } catch {
    return false;
  }
}

export function deleteProject(id) {
  const store = ls();
  if (!store) return;
  try {
    store.removeItem(PROJECT_KEY_PREFIX + id);
    _saveIndex(listProjectIds().filter((pid) => pid !== id));
  } catch { /* ignore */ }
}

export function duplicateProject(id, newName) {
  const project = readProject(id);
  if (!project) return null;
  const now = new Date().toISOString();
  const dupe = {
    ...project,
    id: crypto.randomUUID(),
    name: newName ?? `${project.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  writeProject(dupe);
  return dupe;
}

// ── Active project ────────────────────────────────────────────────────────────

export function getActiveProjectId() {
  const store = ls();
  if (!store) return null;
  try { return store.getItem(ACTIVE_KEY) ?? null; } catch { return null; }
}

export function setActiveProjectId(id) {
  const store = ls();
  if (!store) return;
  try { store.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
}

export function clearActiveProjectId() {
  const store = ls();
  if (!store) return;
  try { store.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
}

// ── Storage usage ─────────────────────────────────────────────────────────────

export function estimateStorageUsage() {
  const store = ls();
  if (!store) return { usedBytes: 0, totalBytes: 5 * 1024 * 1024, projects: [] };

  const ids = listProjectIds();
  const projects = [];
  let usedBytes = 0;

  for (const id of ids) {
    const raw = store.getItem(PROJECT_KEY_PREFIX + id) ?? '';
    const bytes = new Blob([raw]).size;
    usedBytes += bytes;
    const meta = readProjectMeta(id);
    if (meta) projects.push({ ...meta, bytes });
  }

  // Include index + active keys
  [INDEX_KEY, ACTIVE_KEY].forEach((k) => {
    usedBytes += new Blob([store.getItem(k) ?? '']).size;
  });

  const ESTIMATED_TOTAL = 5 * 1024 * 1024;
  return { usedBytes, totalBytes: ESTIMATED_TOTAL, projects };
}

// ── File export / import ──────────────────────────────────────────────────────

export function exportProjectToFile(project) {
  if (typeof window === 'undefined') return;
  const envelope = {
    documentType: 'rack-editor-project',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: 'RackEditor', version: 'web-v1' },
    project,
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `${(project.name || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importProjectFromFile(file) {
  if (!file || typeof file.text !== 'function') throw new Error('Invalid file input.');
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Invalid JSON file.');
  }

  let project;

  if (parsed.project && parsed.project.cad) {
    // New project envelope format
    project = parsed.project;
  } else if (parsed.documentType === 'rack-editor-project' && parsed.layout) {
    // Old CAD-only format (schemaVersion 1.0.0) — wrap in project envelope
    const now = new Date().toISOString();
    project = {
      id: crypto.randomUUID(),
      name: 'Imported Project',
      createdAt: now,
      updatedAt: now,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      cad: parsed,
      quote: null,
    };
  } else {
    throw new Error('Unsupported or unrecognised project file format.');
  }

  // Always assign a new ID to avoid clobbering an existing project
  const imported = { ...project, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
  writeProject(imported);
  return imported;
}
