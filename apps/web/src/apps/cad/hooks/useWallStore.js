// ─────────────────────────────────────────────────────────────────────────────
//  useWallStore — React hook that bridges the WallStore to React state.
//
//  • Creates a single wall store per component tree (via ref).
//  • Triggers re-renders on store changes via useSyncExternalStore.
//  • Exposes the full store API + a `version` number for keyed rendering.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { createWallStore } from '../services/wall/wallStore.js';

/**
 * React hook to create and subscribe to a WallStore.
 *
 * @returns {{ store: ReturnType<typeof createWallStore>, version: number }}
 */
export default function useWallStore() {
  const storeRef   = useRef(null);
  const versionRef = useRef(0);

  // Lazily create the singleton store
  if (storeRef.current === null) {
    storeRef.current = createWallStore();
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
