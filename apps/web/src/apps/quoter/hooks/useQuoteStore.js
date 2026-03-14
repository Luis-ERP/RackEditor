// ─────────────────────────────────────────────────────────────────────────────
//  useQuoteStore — React hook that bridges QuoteStore to React state.
//
//  • Creates a single store per component tree (via ref).
//  • Triggers re-renders on store changes via useSyncExternalStore.
//  • Exposes the full store API + a `version` number for keyed rendering.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { createQuoteStore } from '../services/quoteStore.js';

/**
 * React hook to create and subscribe to a QuoteStore.
 *
 * @param {Object} [initialQuoteParams] — optional params for the initial quote
 * @returns {{ store: ReturnType<typeof createQuoteStore>, version: number }}
 */
export default function useQuoteStore(initialQuoteParams) {
  const storeRef = useRef(null);
  const versionRef = useRef(0);
  const initRef = useRef(initialQuoteParams);

  if (storeRef.current === null) {
    storeRef.current = createQuoteStore(initRef.current);
  }

  const store = storeRef.current;

  const subscribe = useCallback(
    (onStoreChange) =>
      store.subscribe(() => {
        versionRef.current += 1;
        onStoreChange();
      }),
    [store],
  );

  const getSnapshot = useCallback(() => versionRef.current, []);

  const version = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { store, version };
}
