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

/**
 * Fetch a paginated, filtered list of quotes.
 *
 * @param {{ search?: string, status?: string, page?: number, pageSize?: number }} params
 * @returns {Promise<{ count: number, page: number, pageSize: number, totalPages: number, results: object[] }>}
 */
export async function listQuotes({ search = '', status = '', page = 1, pageSize = 20 } = {}) {
  const params = { page, page_size: pageSize };
  if (search) params.search = search;
  if (status) params.status = status;
  const response = await httpClient.get('/api/quotes/', { params });
  return response.data;
}

/**
 * Fetch a single quote with all line items.
 *
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getQuote(id) {
  const response = await httpClient.get(`/api/quotes/${id}/`);
  return response.data;
}

/**
 * Delete a single quote.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteQuote(id) {
  await httpClient.delete(`/api/quotes/${id}/`);
}

/**
 * Duplicate a quote, returning the new lightweight quote object.
 *
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function duplicateQuote(id) {
  const response = await httpClient.post(`/api/quotes/${id}/duplicate/`);
  return response.data;
}

/**
 * Delete multiple quotes by id.
 *
 * @param {string[]} ids
 * @returns {Promise<{ deleted: number }>}
 */
export async function bulkDeleteQuotes(ids) {
  const response = await httpClient.delete('/api/quotes/bulk/', { data: { ids } });
  return response.data;
}
