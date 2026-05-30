// ─────────────────────────────────────────────────────────────────────────────
//  Quote Store Singleton
//
//  Module-level singleton so both CAD and Quoter pages share the same quote
//  instance across Next.js route navigations.
// ─────────────────────────────────────────────────────────────────────────────

import { createQuoteStore } from './quoteStore.js';

let _store = null;

export function getQuoteStore() {
  if (typeof window === 'undefined') return createQuoteStore();
  if (!_store) _store = createQuoteStore();
  return _store;
}
