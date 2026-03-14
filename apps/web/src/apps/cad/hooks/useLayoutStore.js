// ─────────────────────────────────────────────────────────────────────────────
//  useLayoutStore — React hook that bridges the LayoutStore to React state.
//
//  • Creates a single store per component tree (via ref).
//  • Triggers re-renders on store changes via useSyncExternalStore pattern.
//  • Exposes the full store API + a `version` number for keyed rendering.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { createLayoutStore } from '../services/layout/layoutStore.js';

/**
 * React hook to create and subscribe to a LayoutStore.
 *
 * @returns {{ store: ReturnType<typeof createLayoutStore>, version: number }}
 */
export default function useLayoutStore() {
  const storeRef   = useRef(null);
  const versionRef = useRef(0);

  // Lazily create the singleton store
  if (storeRef.current === null) {
    storeRef.current = createLayoutStore();
  }

  const store = storeRef.current;

  // Subscribe / getSnapshot for useSyncExternalStore
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
