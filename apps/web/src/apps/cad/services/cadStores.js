// ─────────────────────────────────────────────────────────────────────────────
//  CAD Store Singletons
//
//  Module-level singleton instances for all CAD stores. Using singletons lets
//  the project system subscribe to stores at module load time and share store
//  state across Next.js route navigations (CAD ↔ Quoter).
//
//  Guards against SSR: functions fall back to fresh instances on the server so
//  server renders never share state across requests.
// ─────────────────────────────────────────────────────────────────────────────

import { createLayoutStore } from './layout/layoutStore.js';
import { createWallStore } from './wall/wallStore.js';
import { createColumnStore } from './column/columnStore.js';
import { createNoteStore } from './note/noteStore.js';

let _layout = null;
let _wall = null;
let _column = null;
let _note = null;

function isClient() {
  return typeof window !== 'undefined';
}

export function getLayoutStore() {
  if (!isClient()) return createLayoutStore();
  if (!_layout) _layout = createLayoutStore();
  return _layout;
}

export function getWallStore() {
  if (!isClient()) return createWallStore();
  if (!_wall) _wall = createWallStore();
  return _wall;
}

export function getColumnStore() {
  if (!isClient()) return createColumnStore();
  if (!_column) _column = createColumnStore();
  return _column;
}

export function getNoteStore() {
  if (!isClient()) return createNoteStore();
  if (!_note) _note = createNoteStore();
  return _note;
}

// Shared Map written by CADCanvas, read by EditorPanel and project serializer.
export const rackDomainSingleton = new Map();

// Canvas display state (written by CadWorkspacePage, read by projectStore).
let _canvas = {
  darkMode: false,
  rackOrientation: 'horizontal',
  drawingMode: false,
  wallMode: null,
  columnMode: false,
  noteMode: false,
  showMeasurements: true,
};

export function getCanvasState() {
  return { ..._canvas };
}

export function setCanvasState(updates) {
  _canvas = { ..._canvas, ...updates };
}
