import axios from 'axios';
import { getAccessToken, clearAccessToken } from '@/src/core/auth/tokenStorage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Central place to react to expired/invalid JWTs.
    if (error?.response?.status === 401) {
      clearAccessToken();
    }
    return Promise.reject(error);
  },
);
