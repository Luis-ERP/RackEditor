import { httpClient } from './httpClient';

/**
 * Sends the CAD editor export payload to the backend.
 * Creates a persisted Quote with CAD-linked QuoteLineItems from the BOM snapshot.
 *
 * @param {object} cadPayload - Output of buildCadToQuotePayload()
 * @returns {Promise<object>} The created Quote with its lineItems
 */
export async function saveCadAndCreateQuote(cadPayload) {
  const response = await httpClient.post('/api/quotes/from-cad/', cadPayload);
  return response.data;
}
