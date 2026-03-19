import { httpClient } from './httpClient';

/**
 * Persist a CAD design revision to the backend.
 *
 * @param {object} cadPayload - CAD export payload including bomSnapshot and projectDocument.
 * @returns {Promise<object>} The created design revision record.
 */
export async function submitCadDesign(cadPayload) {
  const response = await httpClient.post('/api/cad/design-revisions/', cadPayload);
  return response.data;
}