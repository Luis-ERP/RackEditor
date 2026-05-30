// ─────────────────────────────────────────────────────────────────────────────
//  Tutorial Store Singleton
//
//  Module-level singleton so the tutorial state persists across Next.js route
//  navigations (CAD → Quoter mid-lab). Guards against SSR.
// ─────────────────────────────────────────────────────────────────────────────

import { createTutorialStore } from './tutorialStore.js';

let _store = null;

export function getTutorialStore() {
  if (typeof window === 'undefined') return createTutorialStore();
  if (!_store) _store = createTutorialStore();
  return _store;
}
