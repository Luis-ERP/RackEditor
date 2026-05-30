// ─────────────────────────────────────────────────────────────────────────────
//  Project Store
//
//  Module-level singleton that owns the project registry state.
//  Subscribes to all CAD and Quote store singletons, debounces auto-save, and
//  provides project CRUD operations.
//
//  Follows the same subscribe/notify pattern as layoutStore / quoteStore.
// ─────────────────────────────────────────────────────────────────────────────

import {
  listProjectIds,
  readProject,
  readProjectMeta,
  writeProject,
  deleteProject,
  duplicateProject,
  getActiveProjectId,
  setActiveProjectId,
  clearActiveProjectId,
  PROJECT_SCHEMA_VERSION,
} from './projectStorage.js';
import {
  serializeProjectDocument,
  restoreProjectDocument,
  isValidProjectDocument,
} from '../export/projectDocumentExporter.js';
import {
  getLayoutStore,
  getWallStore,
  getColumnStore,
  getNoteStore,
  getCanvasState,
  setCanvasState,
  rackDomainSingleton,
} from '../cadStores.js';
import { getQuoteStore } from '../../../quoter/services/quoteSingleton.js';

// ── State ─────────────────────────────────────────────────────────────────────

const _state = {
  projects: [],   // ProjectMeta[]
  activeId: null,
  dirty: false,
};

const _listeners = [];
let _saveTimer = null;
let _isRestoring = false;
let _initialised = false;

// ── Subscription ──────────────────────────────────────────────────────────────

function _notify() {
  for (const fn of _listeners) fn();
}

function subscribe(listener) {
  _listeners.push(listener);
  return () => {
    const idx = _listeners.indexOf(listener);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

function getState() {
  return { projects: _state.projects, activeId: _state.activeId, dirty: _state.dirty };
}

// ── Auto-save ─────────────────────────────────────────────────────────────────

function _scheduleSave() {
  if (typeof window === 'undefined' || !_state.activeId) return;
  if (_saveTimer) window.clearTimeout(_saveTimer);
  _saveTimer = window.setTimeout(_flushSave, 500);
}

function _setDirty() {
  if (_isRestoring) return;
  if (!_state.dirty) {
    _state.dirty = true;
    _notify();
  }
  _scheduleSave();
}

function _flushSave() {
  if (!_state.activeId) return;
  const existing = readProject(_state.activeId);
  if (!existing) return;

  const rackDomainRef = { current: rackDomainSingleton };
  const cad = serializeProjectDocument({
    layoutStore: getLayoutStore(),
    wallStore: getWallStore(),
    columnStore: getColumnStore(),
    rackDomainRef,
    canvas: getCanvasState(),
  });
  const quote = getQuoteStore().snapshot();

  const ok = writeProject({ ...existing, cad, quote });
  if (ok) {
    _state.dirty = false;
    _notify();
  }
}

// ── Open project ──────────────────────────────────────────────────────────────

function _restoreProject(project) {
  _isRestoring = true;
  try {
    const cadDoc = project.cad;
    if (cadDoc && isValidProjectDocument(cadDoc)) {
      try {
        restoreProjectDocument({
          doc: cadDoc,
          layoutStore: getLayoutStore(),
          wallStore: getWallStore(),
          columnStore: getColumnStore(),
          rackDomainRef: { current: rackDomainSingleton },
          onRestoreCanvas: null,
        });
      } catch (e) {
        console.warn('[projectStore] Failed to restore CAD document:', e.message);
      }

      if (cadDoc.canvas) {
        setCanvasState(cadDoc.canvas);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('rack-editor:canvas-restore', { detail: cadDoc.canvas }),
          );
        }
      }
    } else {
      getLayoutStore().clear?.();
      getWallStore().clear?.();
      getColumnStore().clear?.();
      getNoteStore().clear?.();
      rackDomainSingleton.clear();
    }

    const quoteData = project.quote;
    if (quoteData) {
      try {
        getQuoteStore().loadQuote(quoteData);
      } catch (e) {
        console.warn('[projectStore] Failed to restore quote:', e.message);
        getQuoteStore().resetQuote?.();
      }
    } else {
      getQuoteStore().resetQuote?.();
    }
  } finally {
    _isRestoring = false;
  }
}

// ── Migration ─────────────────────────────────────────────────────────────────

function _migrateV1() {
  const store = window.localStorage;
  const OLD_KEY = 'rack-editor:project:main';
  if (store.getItem('rack-editor:projects:index') !== null) return;
  const oldRaw = store.getItem(OLD_KEY);
  if (!oldRaw) return;

  let oldDoc;
  try { oldDoc = JSON.parse(oldRaw); } catch { store.removeItem(OLD_KEY); return; }
  if (!isValidProjectDocument(oldDoc)) { store.removeItem(OLD_KEY); return; }

  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    name: 'Imported Project',
    createdAt: now,
    updatedAt: now,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    cad: oldDoc,
    quote: null,
  };
  writeProject(project);
  setActiveProjectId(project.id);
  store.removeItem(OLD_KEY);
}

// ── Refresh list ──────────────────────────────────────────────────────────────

function refreshProjectList() {
  const ids = listProjectIds();
  _state.projects = ids.map((id) => readProjectMeta(id)).filter(Boolean);
  _notify();
}

// ── Public actions ────────────────────────────────────────────────────────────

function init() {
  if (typeof window === 'undefined') return;
  if (_initialised) return;
  _initialised = true;

  _migrateV1();
  refreshProjectList();

  const activeId = getActiveProjectId();
  if (activeId && readProject(activeId)) {
    _openProject(activeId);
  } else if (_state.projects.length > 0) {
    _openProject(_state.projects[0].id);
  } else {
    createProject('My First Project');
  }

  // Subscribe to all stores for dirty tracking + auto-save
  getLayoutStore().subscribe(_setDirty);
  getWallStore().subscribe(_setDirty);
  getColumnStore().subscribe(_setDirty);
  getNoteStore().subscribe(_setDirty);
  getQuoteStore().subscribe(_setDirty);
}

function _openProject(id) {
  const project = readProject(id);
  if (!project) return;
  _restoreProject(project);
  setActiveProjectId(id);
  _state.activeId = id;
  _state.dirty = false;
  refreshProjectList();
}

function createProject(name) {
  _isRestoring = true;
  try {
    getLayoutStore().clear?.();
    getWallStore().clear?.();
    getColumnStore().clear?.();
    getNoteStore().clear?.();
    rackDomainSingleton.clear();
    getQuoteStore().resetQuote?.();
  } finally {
    _isRestoring = false;
  }

  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    name: name ?? 'New Project',
    createdAt: now,
    updatedAt: now,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    cad: null,
    quote: null,
  };
  writeProject(project);
  setActiveProjectId(project.id);
  _state.activeId = project.id;
  _state.dirty = false;
  refreshProjectList();
  return project;
}

function openProject(id) {
  _openProject(id);
}

function saveActiveProject() {
  if (_saveTimer) {
    window.clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  _flushSave();
}

function renameProject(id, name) {
  const project = readProject(id);
  if (!project) return;
  writeProject({ ...project, name });
  refreshProjectList();
}

function duplicateActiveProject() {
  if (!_state.activeId) return null;
  const existing = readProject(_state.activeId);
  if (!existing) return null;
  const dupe = duplicateProject(_state.activeId, `${existing.name} (copy)`);
  refreshProjectList();
  return dupe;
}

function duplicateProjectById(id) {
  const existing = readProject(id);
  if (!existing) return null;
  const dupe = duplicateProject(id, `${existing.name} (copy)`);
  refreshProjectList();
  return dupe;
}

function deleteProjectById(id) {
  deleteProject(id);
  if (id === _state.activeId) {
    clearActiveProjectId();
    _state.activeId = null;
    refreshProjectList();
    if (_state.projects.length > 0) {
      _openProject(_state.projects[0].id);
    } else {
      createProject('My First Project');
    }
  } else {
    refreshProjectList();
  }
}

export const projectStore = Object.freeze({
  subscribe,
  getState,
  init,
  createProject,
  openProject,
  saveActiveProject,
  renameProject,
  duplicateActiveProject,
  duplicateProjectById,
  deleteProjectById,
  refreshProjectList,
});
