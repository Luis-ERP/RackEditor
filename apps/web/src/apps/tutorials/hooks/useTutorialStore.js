// ─────────────────────────────────────────────────────────────────────────────
//  useTutorialStore — React hook that bridges TutorialStore to React state.
//
//  Returns the module-level singleton so tutorial state persists across
//  Next.js route navigations (e.g., CAD → Quoter during a cross-page lab).
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { getTutorialStore } from '../tutorialSingleton.js';

export default function useTutorialStore() {
  const storeRef = useRef(null);
  const versionRef = useRef(0);

  if (storeRef.current === null) {
    storeRef.current = getTutorialStore();
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

  // Return a stable primitive so useSyncExternalStore doesn't loop.
  // Components read actual state via store.getState() after the re-render.
  const getSnapshot = useCallback(() => versionRef.current, []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { store, state: store.getState() };
}
