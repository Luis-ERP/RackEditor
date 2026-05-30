// ─────────────────────────────────────────────────────────────────────────────
//  useQuoteStore — React hook that bridges QuoteStore to React state.
//
//  Returns the module-level singleton so both the CAD and Quoter pages share
//  the same quote instance across Next.js route navigations.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { getQuoteStore } from '../services/quoteSingleton.js';

export default function useQuoteStore(initialQuoteParams) {
  const storeRef = useRef(null);
  const versionRef = useRef(0);

  if (storeRef.current === null) {
    storeRef.current = getQuoteStore();
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
