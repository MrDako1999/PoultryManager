import axios from 'axios';
import { router } from 'expo-router';
import { getToken, clearToken } from './storage';

const API_BASE_URL = __DEV__
  ? 'http://localhost:5001/api'
  : 'https://api.poultrymanager.io/api';

const api = axios.create({
  baseURL: API_BASE_URL,
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
