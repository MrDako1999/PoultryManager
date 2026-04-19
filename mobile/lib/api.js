import axios from 'axios';
import { router } from 'expo-router';
import { getToken, clearToken } from './storage';

const API_BASE_URL = __DEV__
  ? 'http://localhost:5001/api'
  : 'https://api.poultrymanager.io/api';

// 30s timeout: long enough for slow uplinks (rural farm wifi, tethered LTE),
// short enough that the sync engine doesn't hang `isSyncing=true` forever
// when the device drops off the network mid-request. Without a timeout, the
// popover got stuck on "Syncing…" and the icon spinner spun indefinitely.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearToken();
      router.replace('/(auth)/login');
    }
    return Promise.reject(error);
  }
);

export default api;
