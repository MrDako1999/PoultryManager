import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { getToken, clearToken } from './storage';

// Resolve the dev API host. `localhost` only works on the iOS simulator —
// on an Android emulator it points at the emulator itself (host is 10.0.2.2)
// and on a physical Android/iOS device it points at the phone. We pull the
// Metro bundler's host from expo-constants so that whichever device loaded
// the JS bundle hits the same machine for `/api`.
//
// Override with EXPO_PUBLIC_API_URL in mobile/.env for tunnels / staging.
const DEV_API_PORT = 5001;

const getDevHost = () => {
  // Newer Expo SDKs expose `hostUri` like "192.168.1.5:8081".
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  // Sensible fallbacks if Metro didn't report a host (e.g. running a
  // pre-bundled dev build offline): emulator loopback on Android, host
  // loopback on iOS.
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? `http://${getDevHost()}:${DEV_API_PORT}/api`
    : 'https://api.poultrymanager.io/api');

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[api] base URL =', API_BASE_URL);
}

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
