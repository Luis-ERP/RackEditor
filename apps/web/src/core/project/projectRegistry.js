// Pure localStorage CRUD for the projects list.
// Schema: { id: string, name: string, createdAt: ISO, updatedAt: ISO }
// No React imports — this is a pure utility module.

const REGISTRY_KEY = 'rack-editor:projects-registry';

function ls() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

function readRegistry() {
  const store = ls();
  if (!store) return [];
  try {
    const raw = store.getItem(REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRegistry(projects) {
  const store = ls();
  if (!store) return;
  try { store.setItem(REGISTRY_KEY, JSON.stringify(projects)); } catch { /* quota */ }
}

export function listProjects() {
  return readRegistry();
}

export function createProject(name) {
  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    name: name ?? 'Untitled Project',
    createdAt: now,
    updatedAt: now,
  };
  const projects = readRegistry();
  projects.push(project);
  writeRegistry(projects);
  return project;
}

export function updateProject(id, fields) {
  const projects = readRegistry();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated = { ...projects[idx], ...fields, id, updatedAt: new Date().toISOString() };
  projects[idx] = updated;
  writeRegistry(projects);
  return updated;
}

export function deleteProject(id) {
  const projects = readRegistry();
  writeRegistry(projects.filter((p) => p.id !== id));
}

const LEGACY_PROJECT_KEY = 'rack-editor:project:main';
const MIGRATION_SENTINEL = 'rack-editor:migration:legacy-migrated';

// Runs at most once (guarded by MIGRATION_SENTINEL). If the registry is empty
// but the old 'rack-editor:project:main' cache exists, creates a 'main' entry
// in the registry so existing data is not lost. Returns true if a migration
// entry was written.
export function migrateLegacyMainProject() {
  const store = ls();
  if (!store) return false;
  if (store.getItem(MIGRATION_SENTINEL)) return false;
  store.setItem(MIGRATION_SENTINEL, '1');
  const projects = readRegistry();
  if (projects.length > 0) return false;
  if (!store.getItem(LEGACY_PROJECT_KEY)) return false;
  const now = new Date().toISOString();
  writeRegistry([{ id: 'main', name: 'My First Project', createdAt: now, updatedAt: now }]);
  return true;
}
