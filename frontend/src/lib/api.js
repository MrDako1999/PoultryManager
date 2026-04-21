import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status === 401) {
      const isAuthRoute = window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/register');
      if (!isAuthRoute) {
        window.location.href = '/login';
      }
    }

    if (status === 402 && code === 'SUBSCRIPTION_INACTIVE') {
      // Workspace got blocked mid-session. Refresh /auth/me so the
      // gate hook flips and BillingLockScreen takes over without a
      // page reload. Dynamic import to dodge the cycle (api <-> store).
      import('@/stores/authStore')
        .then((mod) => mod.default.getState().refreshUser?.())
        .catch(() => {});
    }

    return Promise.reject(error);
  }
);

export default api;
