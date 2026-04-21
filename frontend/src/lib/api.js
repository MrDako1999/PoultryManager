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
      // Only force-redirect to /login when the user is actually inside the
      // protected app shell (`/dashboard/*` or `/first-login`). Marketing
      // routes (/, /privacy, /terms, /contact, /account-deletion) and the
      // public auth routes (/login, /register) all silently tolerate a 401
      // — anonymous visitors hitting the landing page get a 401 from the
      // initial /auth/me probe in authStore.checkAuth() and that's normal,
      // not a reason to bounce them to /login.
      const path = window.location.pathname;
      const insideAppShell = path.startsWith('/dashboard') || path.startsWith('/first-login');
      if (insideAppShell) {
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
