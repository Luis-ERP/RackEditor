// ─────────────────────────────────────────────────────────────────────────────
//  useNoteStore — React hook that bridges the NoteStore to React state.
//
//  • Creates a single note store per component tree (via ref).
//  • Triggers re-renders on store changes via useSyncExternalStore.
//  • Exposes the full store API + a `version` number for keyed rendering.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { createNoteStore } from '../services/note/noteStore.js';

/**
 * React hook to create and subscribe to a NoteStore.
 *
 * @returns {{ store: ReturnType<typeof createNoteStore>, version: number }}
 */
export default function useNoteStore() {
  const storeRef   = useRef(null);
  const versionRef = useRef(0);

  if (storeRef.current === null) {
    storeRef.current = createNoteStore();
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
