import { httpClient } from '@/src/core/api/httpClient';
import { clearTokens, setTokens } from '@/src/core/auth/tokenStorage';

export async function loginWithCredentials(payload) {
  const response = await httpClient.post('/api/auth/token/', payload);
  const access = response?.data?.access;
  const refresh = response?.data?.refresh;

  if (access && refresh) {
    setTokens({ access, refresh });
  }

  return response.data;
}

export async function registerWithCredentials(payload) {
  const response = await httpClient.post('/api/auth/register/', payload);
  return response.data;
}

export async function fetchCurrentUser() {
  const response = await httpClient.get('/api/auth/me/');
  return response.data;
}

export function logout() {
  clearTokens();
}
