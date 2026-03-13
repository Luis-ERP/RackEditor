// ─────────────────────────────────────────────────────────────────────────────
//  RackEditor Project Document Exporter
//
//  Persists full editor progress in two forms:
//    1) Cache (localStorage) for quick recovery
//    2) JSON file for shareable project snapshots
//
//  First-iteration schema intentionally follows existing domain/store shapes.
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECT_DOCUMENT_TYPE = 'rack-editor-project';
export const PROJECT_DOCUMENT_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_PROJECT_CACHE_KEY = 'default';

const CACHE_KEY_PREFIX = 'rack-editor:project:';

function cacheKeyFor(scopeKey = DEFAULT_PROJECT_CACHE_KEY) {
	return `${CACHE_KEY_PREFIX}${scopeKey}`;
}

function deepClone(value) {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value));
}

function normalizeCanvasSettings(canvas) {
	return {
		darkMode: Boolean(canvas?.darkMode),
		rackOrientation: canvas?.rackOrientation ?? 'horizontal',
		drawingMode: Boolean(canvas?.drawingMode),
		wallMode: canvas?.wallMode ?? null,
		columnMode: Boolean(canvas?.columnMode),
	};
}

function getRackDomainSnapshot(layoutEntities, rackDomainRef) {
	const map = rackDomainRef?.current;
	if (!map || typeof map.get !== 'function') return [];

	const neededDomainIds = new Set();
	for (const ent of layoutEntities) {
		if (ent.type === 'RACK_MODULE' || ent.type === 'RACK_LINE') {
			if (ent.domainId) neededDomainIds.add(ent.domainId);
		}
	}

	const modules = [];
	for (const id of neededDomainIds) {
		const mod = map.get(id);
		if (mod) modules.push(deepClone(mod));
	}
	return modules;
}

export function serializeProjectDocument({
	layoutStore,
	wallStore,
	columnStore,
	rackDomainRef,
	canvas,
}) {
	const layoutEntities = layoutStore?.snapshot ? layoutStore.snapshot() : [];
	const wallSnapshot = wallStore?.snapshot ? wallStore.snapshot() : null;
	const columnSnapshot = columnStore?.snapshot ? columnStore.snapshot() : null;
	const rackDomainModules = getRackDomainSnapshot(layoutEntities, rackDomainRef);

	return {
		documentType: PROJECT_DOCUMENT_TYPE,
		schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
		exportedAt: new Date().toISOString(),
		app: {
			name: 'RackEditor',
			version: 'web-v1',
		},
		layout: {
			entities: layoutEntities,
		},
		semantics: {
			rackDomain: {
				modules: rackDomainModules,
			},
			wallStore: wallSnapshot,
			columnStore: columnSnapshot,
		},
		canvas: normalizeCanvasSettings(canvas),
	};
}

export function isValidProjectDocument(doc) {
	if (!doc || typeof doc !== 'object') return false;
	if (doc.documentType !== PROJECT_DOCUMENT_TYPE) return false;
	if (!doc.schemaVersion || typeof doc.schemaVersion !== 'string') return false;
	if (!doc.layout || !Array.isArray(doc.layout.entities)) return false;
	return true;
}

export function cacheProjectDocument(doc, scopeKey = DEFAULT_PROJECT_CACHE_KEY) {
	if (typeof window === 'undefined' || !window.localStorage) return false;
	if (!isValidProjectDocument(doc)) return false;

	try {
		window.localStorage.setItem(cacheKeyFor(scopeKey), JSON.stringify(doc));
		return true;
	} catch {
		return false;
	}
}

export function loadCachedProjectDocument(scopeKey = DEFAULT_PROJECT_CACHE_KEY) {
	if (typeof window === 'undefined' || !window.localStorage) return null;

	try {
		const raw = window.localStorage.getItem(cacheKeyFor(scopeKey));
		if (!raw) return null;

		const parsed = JSON.parse(raw);
		return isValidProjectDocument(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function restoreProjectDocument({
	doc,
	layoutStore,
	wallStore,
	columnStore,
	rackDomainRef,
	onRestoreCanvas,
}) {
	if (!isValidProjectDocument(doc)) {
		throw new Error('Invalid project document format.');
	}

	const entities = doc.layout?.entities ?? [];
	layoutStore?.restore?.(entities);

	if (doc.semantics?.wallStore) {
		wallStore?.restore?.(doc.semantics.wallStore);
	}

	if (doc.semantics?.columnStore) {
		columnStore?.restore?.(doc.semantics.columnStore);
	}

	if (rackDomainRef?.current && typeof rackDomainRef.current.clear === 'function') {
		rackDomainRef.current.clear();
		const modules = doc.semantics?.rackDomain?.modules ?? [];
		for (const mod of modules) {
			if (mod?.id) rackDomainRef.current.set(mod.id, mod);
		}
	}

	if (typeof onRestoreCanvas === 'function' && doc.canvas) {
		onRestoreCanvas(doc.canvas);
	}
}

export function parseProjectDocumentText(rawText) {
	if (typeof rawText !== 'string') {
		throw new Error('Project document payload must be text.');
	}

	let parsed;
	try {
		parsed = JSON.parse(rawText);
	} catch {
		throw new Error('Invalid JSON file.');
	}

	if (!isValidProjectDocument(parsed)) {
		throw new Error('Unsupported or invalid project document schema.');
	}

	return parsed;
}

export async function readProjectDocumentFile(file) {
	if (!file || typeof file.text !== 'function') {
		throw new Error('Invalid file input.');
	}

	const rawText = await file.text();
	return parseProjectDocumentText(rawText);
}

export async function importProjectDocumentFromFile({
	file,
	layoutStore,
	wallStore,
	columnStore,
	rackDomainRef,
	onRestoreCanvas,
	scopeKey = DEFAULT_PROJECT_CACHE_KEY,
}) {
	const doc = await readProjectDocumentFile(file);

	restoreProjectDocument({
		doc,
		layoutStore,
		wallStore,
		columnStore,
		rackDomainRef,
		onRestoreCanvas,
	});

	cacheProjectDocument(doc, scopeKey);
	return doc;
}

export function downloadProjectDocument({
	layoutStore,
	wallStore,
	columnStore,
	rackDomainRef,
	canvas,
	fileName = 'rack-project.json',
	scopeKey = DEFAULT_PROJECT_CACHE_KEY,
}) {
	const doc = serializeProjectDocument({
		layoutStore,
		wallStore,
		columnStore,
		rackDomainRef,
		canvas,
	});

	cacheProjectDocument(doc, scopeKey);

	if (typeof window !== 'undefined' && window.document) {
		const payload = JSON.stringify(doc, null, 2);
		const blob = new Blob([payload], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = window.document.createElement('a');
		a.href = url;
		a.download = fileName;
		window.document.body.appendChild(a);
		a.click();
		window.document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	return doc;
}
