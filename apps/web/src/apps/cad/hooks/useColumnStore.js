// ─────────────────────────────────────────────────────────────────────────────
//  useColumnStore — React hook that bridges the ColumnStore to React state.
//
//  Returns the module-level singleton so all components share the same instance
//  across Next.js route navigations.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { getColumnStore } from '../services/cadStores.js';

export default function useColumnStore() {
  const storeRef   = useRef(null);
  const versionRef = useRef(0);

  if (storeRef.current === null) {
    storeRef.current = getColumnStore();
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
