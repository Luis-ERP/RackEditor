import { httpClient } from '@/src/core/api/httpClient';
import { API_ENDPOINTS } from '@/src/core/api/endpoints';
import { setAccessToken, clearAccessToken } from '@/src/core/auth/tokenStorage';

export async function loginWithCredentials(payload) {
  const response = await httpClient.post(API_ENDPOINTS.auth.login, payload);
  const accessToken = response?.data?.accessToken;
  if (accessToken) {
    setAccessToken(accessToken);
  }
  return response.data;
}

export function logout() {
  clearAccessToken();
}
