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
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status === 401) {
      // USER_DELETED comes from the backend protect middleware after a
      // soft-delete cascade. Force-logout exactly the same way as a
      // generic 401 — the user can't do anything anyway.
      await clearToken();
      router.replace('/(auth)/login');
    }

    if (status === 402 && code === 'SUBSCRIPTION_INACTIVE') {
      // Workspace got locked mid-session. Refresh /auth/me so the gate
      // hook flips to 'block' and the BillingLockScreen takes over.
      // Lazy require to avoid a circular import (syncEngine -> api -> ...).
      try {
        const { refreshAuthAndSubscription } = require('./syncEngine');
        refreshAuthAndSubscription().catch(() => {});
      } catch {}
    }

    return Promise.reject(error);
  }
);

export default api;
