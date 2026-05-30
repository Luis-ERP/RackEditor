// ─────────────────────────────────────────────────────────────────────────────
//  useNoteStore — React hook that bridges the NoteStore to React state.
//
//  Returns the module-level singleton so all components share the same instance
//  across Next.js route navigations.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { getNoteStore } from '../services/cadStores.js';

export default function useNoteStore() {
  const storeRef   = useRef(null);
  const versionRef = useRef(0);

  if (storeRef.current === null) {
    storeRef.current = getNoteStore();
  }

  const store = storeRef.current;

  const subscribe = useCallback(
    (onStoreChange) => store.subscribe(() => {
      versionRef.current += 1;
      onStoreChange();
    }),
    [store],
  );

  const getSnapshot = useCallback(() => versionRef.current, []);

  const version = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { store, version };
}
