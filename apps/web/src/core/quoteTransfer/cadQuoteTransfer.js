const CAD_TO_QUOTE_TRANSFER_KEY = 'rack-editor:cad-to-quote';

function isValidCadToQuoteTransfer(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && typeof payload.designId === 'string'
      && typeof payload.designRevisionId === 'string'
      && payload.bomSnapshot
      && Array.isArray(payload.bomSnapshot.items),
  );
}

export function saveCadToQuoteTransfer(payload) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  if (!isValidCadToQuoteTransfer(payload)) return false;

  window.localStorage.setItem(CAD_TO_QUOTE_TRANSFER_KEY, JSON.stringify(payload));
  return true;
}

export function peekCadToQuoteTransfer() {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(CAD_TO_QUOTE_TRANSFER_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return isValidCadToQuoteTransfer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function consumeCadToQuoteTransfer() {
  const payload = peekCadToQuoteTransfer();

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(CAD_TO_QUOTE_TRANSFER_KEY);
  }

  return payload;
}

export { CAD_TO_QUOTE_TRANSFER_KEY };