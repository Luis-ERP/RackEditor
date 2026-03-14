import { httpClient } from '@/src/core/api/httpClient';
import { setAccessToken, clearAccessToken } from '@/src/core/auth/tokenStorage';

export async function loginWithCredentials(payload) {
  const response = await httpClient.post('/auth/login', payload);
  const accessToken = response?.data?.accessToken;
  if (accessToken) {
    setAccessToken(accessToken);
  }
  return response.data;
}

export function logout() {
  clearAccessToken();
}
