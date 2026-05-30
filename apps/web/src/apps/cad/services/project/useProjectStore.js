// ─────────────────────────────────────────────────────────────────────────────
//  useProjectStore — React hook that bridges projectStore to React state.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useSyncExternalStore } from 'react';
import { projectStore } from './projectStore.js';

export default function useProjectStore() {
  const subscribe = useCallback(
    (onStoreChange) => projectStore.subscribe(onStoreChange),
    [],
  );

  const getSnapshot = useCallback(() => {
    const s = projectStore.getState();
    // Include project names/timestamps so renames and updates cause re-renders
    const projectSig = s.projects.map((p) => `${p.id}:${p.name}:${p.updatedAt}`).join('|');
    return `${s.activeId}|${s.dirty}|${projectSig}`;
  }, []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return projectStore.getState();
}
